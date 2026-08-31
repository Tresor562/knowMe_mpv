# KMD-363 — Prove production runtime containers actually boot healthy

## Problem

KMD-362 embedded bounded liveness healthchecks in the API and Web runtime images and canonical CI verified their metadata. Metadata inspection alone does not prove that the exact production command starts, remains alive and reaches the declared health endpoint.

KMD-363 therefore makes a production-image boot a merge gate. It deliberately keeps the application in `NODE_ENV=production` and does not weaken production security/configuration guards merely to make CI green.

## Failure history and corrections

The runtime proof has exposed several real gaps that ordinary build/test gates did not catch:

1. **CI #1283 — workspace packaging.** `Dockerfile.api` built only `@knowme/api` even though runtime workspace contracts publish generated `dist/` entrypoints. The image now builds the full dependency closure with `pnpm --filter @knowme/api... build`.
2. **CI #1286/#1292 — explicit production configuration.** Runtime startup requires release identity, process-local rate-limit topology/configuration, trusted-proxy hops and an HTTPS non-local CORS origin. The CI boot supplies CI-scoped values instead of bypassing those guards.
3. **CI #1294 — HTTP server policy.** Production startup also requires explicit request/header/keep-alive timeouts. CI now supplies the canonical repository values `30000` / `15000` / `5000` ms.
4. **CI #1301 — media storage policy.** Production forbids the default local media driver. The isolated boot proof uses the `s3` driver with a reserved synthetic HTTPS endpoint and dummy CI-only credentials. `/health/live` performs no media operation, so this is configuration validation only and is not evidence of real object-storage connectivity or durability.
5. **CI #1304 — Nest internal abort.** `NestFactory.create()` could terminate internally before the entrypoint's bounded failure handler ran. It now uses `abortOnError: false`; startup remains fail-closed because the outer handler preserves a non-zero exit status.
6. **CI #1307/#1310 — pre-bootstrap application-module evaluation.** `AppModule` is a large decorator-driven graph and evaluates policies/imports while the module itself is loaded. KMD-363 now loads `AppModule` dynamically inside a dedicated `application-module-load` phase so graph-loading failures are owned by the bounded bootstrap promise.
7. **CI #1313 — entrypoint boundary gap.** Supply-chain, frozen install, audit, Prisma/migrations/drift, monorepo build, all tests, Docker image build, non-root identity and healthcheck metadata were green, but the API exited before any `main.ts` bootstrap diagnostic was emitted. Because JavaScript evaluates `main.ts` static imports before its body installs `bootstrap().catch()`, KMD-363 now starts production through a minimal `launcher.ts`. The launcher registers bounded `uncaughtException` / `unhandledRejection` guards and requires `main.ts` inside an owned synchronous boundary. It logs only a fixed allowlisted category and never receives, serializes or prints the thrown value.
8. **CI #1317 — static runtime imports still escaped the bootstrap boundary.** The launcher proved the failure still occurred while evaluating `main.ts` itself. `main.ts` therefore no longer has static runtime imports: Nest and the startup-policy modules are loaded inside a dedicated `runtime-module-load` bootstrap phase. Module-resolution/configuration failures can now reach the existing bounded classifier instead of terminating before `bootstrap().catch()` exists. A preflight locks this property by rejecting new top-level imports in `main.ts`.
9. **CI #1320 — runtime failure remained isolated but raw job logs were not retrievable through the available repository integration.** Supply-chain, frozen install, production audit, Prisma/migrations/drift, monorepo build/tests, API image build, non-root identity and healthcheck metadata were all green; only the real API boot failed. The failure step now writes the bounded Docker state, health history, direct liveness attempt and container logs to `$RUNNER_TEMP/knowme-api-runtime-diagnostics.log` and uploads that file as a seven-day `knowme-api-runtime-diagnostics` artifact on failure. The artifact action is pinned to an immutable reviewed commit and is covered by the CI supply-chain preflight. This changes observability only: the boot gate remains fail-closed and unchanged.
10. **CI #1324 — supply-chain parser missed named `uses:` steps.** The newly added upload step exposed that the supply-chain preflight only parsed YAML lines written as `- uses:` and therefore could not discover a named step whose `uses:` key is on the following line. The parser now recognizes both forms and audits every external action occurrence against the immutable allowlist. The diagnostic upload is also scoped to `steps.api_runtime_boot.outcome == 'failure'`, so an unrelated earlier CI failure no longer creates a misleading secondary artifact failure when no runtime diagnostic file exists.

The bounded diagnostics report only fixed phases/categories and allowlisted configuration-key names from the application startup boundary. They never intentionally serialize the caught exception, database URI, environment values or other potentially sensitive application runtime detail. Docker state and container logs are retained only as CI diagnostics and must therefore continue to avoid printing secrets from application code.

## Delivery

- Keep KMD-362 healthcheck definitions unchanged.
- Build API runtime dependencies with `pnpm --filter @knowme/api... build`.
- Start the API package through `node dist/launcher.js`; the launcher owns failures that occur before `main.ts` can install its normal bootstrap rejection handler.
- Load all `main.ts` runtime dependencies inside the owned `runtime-module-load` bootstrap phase; keep `main.ts` free of top-level imports.
- Launch the exact API image built by canonical CI and require Docker `healthy` within a bounded 60-second window.
- Launch the exact Web image and require the same bounded healthy transition.
- After Docker reports healthy, request each `/health/live` endpoint directly from the runner.
- Fail immediately if a container exits or becomes `unhealthy`; fail after the bounded window if it never becomes healthy.
- Always remove temporary containers.
- On API boot failure, emit Docker state/exit information, healthcheck history/output, a bounded direct liveness attempt and container logs before cleanup, persist the same bounded evidence to a runner-temp file and upload it as a short-retention CI artifact. Do not run that upload for failures that occur before the API boot step.
- Keep the API boot in `NODE_ENV=production`.
- Supply the CI PostgreSQL connection and JWT secret plus explicit release identity, one-instance process-local rate-limit topology, trusted proxy, HTTP timeout, CORS and media-storage configuration required by existing production guards.
- Use `NestFactory.create(..., { abortOnError: false })` so Nest initialization errors reject to the entrypoint rather than internally terminating before the bounded handler.
- Load `AppModule` with `await import('./app.module')` from inside `bootstrap()` during the bounded `application-module-load` phase so evaluation of the application graph is also owned by that failure boundary.
- Preserve a non-zero process exit on every rejected bootstrap or pre-bootstrap entrypoint failure.
- Repository preflight tests prevent removing the boot proof, making the wait unbounded, changing the runtime to development/test, regressing to a leaf-only API build, omitting required CI production configuration, bypassing the guarded launcher, restoring top-level runtime imports or static `AppModule` loading, restoring Nest internal abort behavior, logging raw startup exceptions, silently removing failure-diagnostic artifact persistence, or hiding named external GitHub Actions from the immutable-pin audit.

## CI-scoped production configuration

The runtime proof currently binds:

- `DATABASE_URL` to the GitHub Actions PostgreSQL service;
- `JWT_SECRET` to CI-only test material;
- `PORT=4000`;
- `KNOWME_RELEASE_COMMIT` to the Actions commit identity and `KNOWME_RELEASE_VERSION=0.0.0-ci`;
- `API_INSTANCE_COUNT=1`;
- `API_RATE_LIMIT_TTL_MS=60000` and `API_RATE_LIMIT_LIMIT=120`;
- `TRUSTED_PROXY_HOPS=0` for the direct runner/container topology;
- `API_REQUEST_TIMEOUT_MS=30000`, `API_HEADERS_TIMEOUT_MS=15000`, `API_KEEP_ALIVE_TIMEOUT_MS=5000`;
- CORS to the reserved HTTPS origin `https://ci.invalid`;
- `MEDIA_STORAGE_DRIVER=s3` with `https://s3.ci.invalid` and synthetic CI credentials.

These values exist only to exercise startup under the repository's production validators. They do not represent production secrets, production domains, real S3 connectivity, horizontal-scale validation or a deployment configuration approval.

## Tests and merge gates

KMD-363 is complete only when CI for the **exact current PR head** passes all existing gates plus:

1. runtime-container boot preflight;
2. workspace runtime dependency build guard;
3. explicit CI-scoped production release/rate-limit/trusted-proxy/timeout/CORS/media configuration checks;
4. bounded pre-bootstrap launcher plus bootstrap-owned runtime/application-module loading and secret-safe diagnostics;
5. failure-diagnostic persistence/upload guard with an immutable pinned artifact action, scoped only to actual API boot failure;
6. supply-chain parser coverage for both anonymous `- uses:` and named-step `uses:` action syntax;
7. actual API production image boot and healthy transition;
8. actual Web production image boot and healthy transition;
9. direct HTTP success from both `/health/live` endpoints;
10. supply-chain policy, frozen lockfile install, production audit threshold, Prisma generation/migration/drift, repository build/unit tests, Docker non-root identity/health metadata, Web E2E and API E2E.

No earlier CI run can validate a newer head. No merge is allowed with a blocking review or unresolved review thread.

## Migration

No Prisma, user-data, public API-contract or client migration is required. KMD-363 changes runtime packaging, CI boot proof and startup failure ownership only.

## Rollback

Revert the KMD-363 commits. This restores KMD-362 behavior where CI builds the images and inspects healthcheck metadata without proving the production commands can boot, restores the previous API packaging/startup behavior, and removes KMD-363 CI-scoped runtime diagnostics/configuration and artifact persistence. No persistent-data rollback is required.

## Operational and proof boundary

A green KMD-363 proves only that the exact images built in GitHub Actions can start and satisfy their declared liveness probes in that CI environment while existing production fail-closed configuration guards remain enabled.

It does **not** prove production orchestration, production secrets, production database behavior, real object-storage connectivity/durability, production CORS/domain/TLS configuration, network policies, alert delivery, backup restoration, physical-device behavior, accessibility on physical devices, legal/privacy compliance, production deployment, or App Store / Google Play publication.

Canonical `main` branch protection is also an external repository-governance requirement and must not be claimed complete until GitHub reports the required protection configuration.
