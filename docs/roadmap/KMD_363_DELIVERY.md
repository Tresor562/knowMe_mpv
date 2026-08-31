# KMD-363 — Prove production runtime containers actually boot healthy

## Problem

KMD-362 embedded bounded liveness healthchecks in the API and Web runtime images and canonical CI verified the image metadata. Metadata inspection alone does not prove that the built production command can start successfully, remain running, and reach the declared health endpoint with the runtime environment expected by CI.

A market-ready release process must fail before merge when a production image builds but cannot actually boot.

The first exact-head KMD-363 CI run exposed a real packaging regression: `@knowme/api` depends on workspace contract packages whose runtime entrypoints are emitted under `dist/`, while `Dockerfile.api` built only the API package. A clean production image could therefore compile successfully yet start without the compiled runtime artifacts of its workspace dependencies.

After fixing the workspace dependency build, exact-head CI #1286 still failed before the API could become healthy. The application intentionally calls `resolveRuntimeReleaseIdentity()` before NestJS bootstrap, and production mode fails closed unless both a canonical Git commit SHA and SemVer release identity are supplied. The boot proof had set `NODE_ENV=production` through the image but omitted those mandatory production values. KMD-363 therefore supplies a CI-scoped identity (`GITHUB_SHA` and `0.0.0-ci`) instead of weakening or bypassing the production guard.

## Delivery

- Keep the KMD-362 healthcheck definitions unchanged.
- After each production image build, canonical CI now launches that exact image as a detached container.
- API boot validation uses the CI PostgreSQL service through host networking and passes CI-scoped `DATABASE_URL`, `JWT_SECRET`, `PORT`, `KNOWME_RELEASE_COMMIT`, and `KNOWME_RELEASE_VERSION` values.
- `KNOWME_RELEASE_COMMIT` is bound to the exact GitHub Actions `GITHUB_SHA`; the synthetic `0.0.0-ci` version is valid SemVer and is explicitly non-production release metadata for this CI boot proof.
- The application remains in `NODE_ENV=production`; KMD-363 does not disable the release-identity fail-closed behavior.
- Web boot validation launches the exact Web image on its production port.
- Both checks poll Docker's real container health state for at most 60 seconds.
- A container that becomes `unhealthy`, exits, or never becomes healthy fails the canonical `quality` job.
- Once healthy, CI also performs an HTTP request against the declared liveness route from the runner.
- Cleanup always removes the temporary container and emits container logs for diagnosis.
- `Dockerfile.api` now builds the API dependency closure with `pnpm --filter @knowme/api... build`, so workspace runtime contracts are compiled before the production command starts.
- A repository preflight test prevents later CI edits from silently removing the runtime boot proof, converting it into an unbounded wait, omitting mandatory CI release identity, switching the boot to development/test mode, or regressing the API image to building only the leaf package.

## Tests and merge gates

KMD-363 is complete only when exact-head CI passes all existing gates plus:

1. the runtime-container boot preflight;
2. the workspace runtime dependency build guard;
3. explicit CI-scoped production release-identity guard coverage;
4. actual API image boot and healthy transition;
5. actual Web image boot and healthy transition;
6. direct HTTP success from both `/health/live` endpoints;
7. all supply-chain, lockfile, audit, Prisma migration/drift, build, unit, Docker identity/metadata, Web E2E and API E2E gates.

No merge is allowed with a blocking review or unresolved review thread.

## Migration

No Prisma, user-data, API-contract or client migration is required. The runtime packaging and CI environment changes only ensure already-declared workspace dependencies are compiled and the existing mandatory production release identity is supplied during the isolated boot proof.

## Rollback

Revert the KMD-363 commits. That restores KMD-362 behavior where CI builds both runtime images and inspects their healthcheck metadata without starting the production containers, restores the prior leaf-only API Docker build, and removes the CI-scoped runtime identity. No persistent data rollback is required.

## Operational and proof boundary

KMD-363 proves that the exact images built in GitHub Actions can boot and satisfy their declared liveness healthchecks in the CI environment while retaining the API's production release-identity guard. It does not prove production orchestration, production secrets, production databases, network policies, alert delivery, backup restoration, physical-device behavior, legal/privacy compliance, production deployment, or App Store / Google Play publication.

Canonical `main` branch protection also remains an external repository-governance requirement and must not be claimed complete until GitHub reports the required protection configuration.
