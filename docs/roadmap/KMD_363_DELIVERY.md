# KMD-363 — Prove production runtime containers actually boot healthy

## Problem

KMD-362 embedded bounded liveness healthchecks in the API and Web runtime images and canonical CI verified the image metadata. Metadata inspection alone does not prove that the built production command can start successfully, remain running, and reach the declared health endpoint with the runtime environment expected by CI.

A market-ready release process must fail before merge when a production image builds but cannot actually boot.

The first KMD-363 CI run exposed a real packaging regression: `@knowme/api` depends on workspace contract packages whose runtime entrypoints are emitted under `dist/`, while `Dockerfile.api` built only the API package. A clean production image could therefore compile successfully yet start without the compiled runtime artifacts of its workspace dependencies.

After fixing the workspace dependency build, CI #1286 still failed before the API could become healthy. The API is deliberately fail-closed in production: its runtime requires an explicit release identity, explicit process-local rate-limit topology/configuration, explicit trusted-proxy hops, and at least one HTTPS non-local CORS origin. The original boot proof supplied only database/JWT/port values. KMD-363 therefore supplies safe CI-scoped values for all of those existing production guards instead of weakening or bypassing them.

CI #1292 on head `fdf8a8f585ea6e42c152da0a19182621c446f2e8` narrowed the remaining failure further. Frozen install, production audit, Prisma generation/migrations/drift, the monorepo build, the full unit/preflight suite, the API image build, non-root runtime identity, and healthcheck metadata all passed. The only failing gate was the actual API runtime healthy transition; downstream Web runtime and E2E gates were correctly skipped. The prior cleanup emitted only the package-manager termination line, which was not sufficient evidence to distinguish process exit from a liveness-response or healthcheck-timing failure. The CI boot step therefore now emits bounded diagnostics on failure: Docker state/exit information, Docker healthcheck history/output, a direct runner-side `/health/live` response, and container logs before cleanup. These diagnostics do not weaken, extend, or bypass the healthy-state requirement.

CI #1294 on head `3684a5e3d4082cf8027131c64ed04c92f53a752f` confirmed that packaging, frozen dependency installation, production audit, Prisma migration/drift checks, repository build/tests, API image build, non-root identity and healthcheck metadata all remain green. The API process itself exits with status 1 during application bootstrap before it can answer `/health/live`. Docker diagnostics proved this is a process-start failure rather than a healthcheck timeout, but the application entrypoint did not identify which bootstrap stage failed.

KMD-363 therefore adds a secret-safe startup diagnostic to the API entrypoint. The entrypoint records only a bounded phase identifier (`release-identity`, `nest-application-create`, `runtime-policy-configuration`, or `http-listen`) and emits that phase if bootstrap rejects. It deliberately does not log the caught exception, message, stack, database URI, environment values, or other potentially sensitive runtime details. The process still exits non-zero. A repository preflight locks this behavior so future debugging cannot silently turn startup failures into secret-bearing logs or a successful exit.

## Delivery

- Keep the KMD-362 healthcheck definitions unchanged.
- After each production image build, canonical CI launches that exact image as a detached container.
- API boot validation uses the CI PostgreSQL service through host networking.
- `KNOWME_RELEASE_COMMIT` is bound to the GitHub Actions `GITHUB_SHA`; the synthetic `0.0.0-ci` version is valid SemVer and is explicitly non-production release metadata for this CI boot proof.
- Process-local rate limiting is explicitly constrained to one CI API instance with the repository defaults (`60000` ms / `120` requests), matching the production fail-closed policy that forbids silent horizontal scaling with process-local limiter state.
- Trusted proxy hops are explicitly `0` for the direct CI runner/container topology.
- CORS uses the reserved non-routable HTTPS origin `https://ci.invalid`; it exists only to satisfy and exercise the production origin validator and is not a production-domain claim.
- The application remains in `NODE_ENV=production`; KMD-363 does not disable release identity, rate-limit topology, trusted-proxy, CORS, HTTPS, or other production guards.
- Web boot validation launches the exact Web image on its production port.
- Both checks poll Docker's real container health state for at most 60 seconds.
- A container that becomes `unhealthy`, exits, or never becomes healthy fails the canonical `quality` job.
- Once healthy, CI also performs an HTTP request against the declared liveness route from the runner.
- API failures emit Docker state, exit code/error, healthcheck history, a bounded direct liveness response, and container logs before cleanup so a failing proof is actionable without changing the acceptance criterion.
- The API entrypoint additionally emits only the bounded bootstrap phase on a rejected startup and never interpolates the caught error into this diagnostic.
- Cleanup always removes the temporary container.
- `Dockerfile.api` builds the API dependency closure with `pnpm --filter @knowme/api... build`, so workspace runtime contracts are compiled before the production command starts.
- A repository preflight prevents later CI edits from silently removing the runtime boot proof, converting it into an unbounded wait, omitting the explicit CI production configuration, switching the boot to development/test mode, regressing the API image to building only the leaf package, or exposing raw bootstrap exceptions for diagnostics.

## Tests and merge gates

KMD-363 is complete only when CI for the current PR head passes all existing gates plus:

1. the runtime-container boot preflight;
2. the workspace runtime dependency build guard;
3. explicit CI-scoped production release identity, rate-limit, trusted-proxy, and CORS guard coverage;
4. secret-safe bounded bootstrap-phase diagnostics;
5. actual API image boot and healthy transition;
6. actual Web image boot and healthy transition;
7. direct HTTP success from both `/health/live` endpoints;
8. all supply-chain, lockfile, audit, Prisma migration/drift, build, unit, Docker identity/metadata, Web E2E and API E2E gates.

No merge is allowed with a blocking review or unresolved review thread.

## Migration

No Prisma, user-data, API-contract or client migration is required. The runtime packaging, CI environment and startup diagnostic changes only ensure already-declared workspace dependencies are compiled, the existing mandatory production runtime configuration is supplied during the isolated boot proof, and a failed bootstrap identifies a non-sensitive phase.

## Rollback

Revert the KMD-363 commits. That restores KMD-362 behavior where CI builds both runtime images and inspects their healthcheck metadata without starting the production containers, restores the prior leaf-only API Docker build, removes the CI-scoped runtime configuration/diagnostics, and restores the prior API entrypoint behavior. No persistent data rollback is required.

## Operational and proof boundary

KMD-363 is intended to prove that the exact images built in GitHub Actions can boot and satisfy their declared liveness healthchecks in the CI environment while retaining the API's existing production fail-closed guards. Until the current-head CI is green, that proof remains incomplete. The bounded phase diagnostic is debugging evidence only and is not itself proof of a successful production boot. It does not prove production orchestration, production secrets, production databases, production CORS domains, network policies, alert delivery, backup restoration, physical-device behavior, legal/privacy compliance, production deployment, or App Store / Google Play publication.

Canonical `main` branch protection also remains an external repository-governance requirement and must not be claimed complete until GitHub reports the required protection configuration.
