# KMD-363 — Prove production runtime containers actually boot healthy

## Problem

KMD-362 embedded bounded liveness healthchecks in the API and Web runtime images and canonical CI verified their metadata. Metadata inspection alone does not prove that the exact production command starts, remains alive and reaches the declared health endpoint.

KMD-363 therefore makes real production-image boot a merge gate. The proof keeps `NODE_ENV=production` and does not weaken production security/configuration guards merely to make CI green.

## Failure history and corrections

The runtime proof has exposed defects that ordinary build/test gates did not catch. Important evidence is retained here because older green runs cannot validate a newer candidate head.

1. **CI #1283 — workspace packaging.** `Dockerfile.api` built only `@knowme/api`; it now builds the full workspace dependency closure with `pnpm --filter @knowme/api... build`.
2. **CI #1286/#1292/#1294/#1301 — explicit production configuration.** Runtime startup requires release identity, rate-limit topology/configuration, trusted-proxy hops, HTTP timeouts, HTTPS CORS and non-local media storage. CI supplies isolated CI values instead of bypassing those guards.
3. **CI #1304/#1307/#1310 — Nest/bootstrap ownership.** Nest now rejects initialization errors to the bounded entrypoint and `AppModule` is loaded dynamically inside `application-module-load` so its graph is inside the startup proof boundary.
4. **CI #1313/#1317 — entrypoint/runtime import boundaries.** The runtime entrypoint was progressively reduced so startup phases can be reported without serializing raw exceptions, stacks, URIs, secrets or environment values.
5. **CI #1320/#1324/#1329 — durable failure evidence.** API boot failure writes bounded Docker/runtime evidence to a seven-day workflow artifact. The external artifact action is immutable-SHA pinned, named `uses:` steps are supply-chain audited, and upload uses `failure() && steps.api_runtime_boot.outcome == 'failure'` so it runs only after the actual API boot fails.
6. **CI #1332/#1336 — direct exit diagnostics.** A non-zero process termination that bypasses the normal rejection path records only an allowlisted startup phase/category with synchronous writes. CI startup phase evidence is opt-in and bounded.
7. **CI #1355 — frozen manifest/lock consistency.** `@types/supertest@6.0.3` had accidentally disappeared from `apps/api/package.json` while remaining in `pnpm-lock.yaml`; the exact dependency was restored instead of weakening frozen installation.
8. **CI #1356/#1358 — compiled entrypoint packaging defect.** Build/tests and image construction passed, but `/app/apps/api/dist/main.js` did not exist at the runtime contract path. The root cause was that the base TypeScript project did not define a release-only source root while TypeScript also exists outside `src`. KMD-363 now has `apps/api/tsconfig.build.json` with `rootDir=src`, `outDir=dist`, runtime-only `src/**/*.ts`, test exclusions and no incremental release artifact dependence. `nest-cli.json` explicitly selects that build config and deletes stale `dist` output before compilation.
9. **CI #1360 — deterministic packaging proved; failure moved deeper.** Supply-chain, frozen install, production audit, Prisma generation/migrations/drift, monorepo build/tests, Docker API build, compiled `dist/main.js` readability/syntax/marker, non-root identity and health metadata all passed. The real API boot then failed. The uploaded bounded phase marker was `application-module-load`, proving the image now reaches evaluation of the `AppModule` graph and that the previous packaging defect is fixed.
10. **Post-#1360 — native runtime dependency isolation.** `AppModule` imports `AuthModule`; `AuthModule` evaluates `AuthService`, which imports native `argon2`. The API also depends on the generated Prisma native/runtime stack. Canonical CI now performs explicit non-root image smoke loads for `argon2` and `PrismaClient` before starting the full graph. This is a permanent production-image compatibility gate, not a bypass: a release image that cannot load its native authentication/data dependencies must fail before merge.
11. **CI #1364 — native gate quoting defect, not a Prisma failure.** The production image loaded `argon2` successfully (`argon2-ok`). The Prisma smoke command did not reach Prisma at all: the container shell expanded `$disconnect` inside the double-quoted `node -e` program, turning `client.$disconnect()` into invalid JavaScript `client.()`. The command now escapes the dollar sign as `client.\$disconnect()` at the shell layer so Node receives the intended Prisma API call. The repository preflight requires this escaping and rejects the unescaped form, preventing a false native-runtime failure from returning.
12. **CI #1367 — native runtime dependencies proved; failure isolated to application graph evaluation.** The exact candidate passed supply-chain policy, frozen install, the production advisory threshold, Prisma generation, all six migrations, zero datamodel drift, monorepo build, 97 API suites / 498 API tests, the repository preflight set, API image construction, compiled entrypoint proof, `argon2` load, `PrismaClient` instantiate/disconnect, non-root identity and healthcheck metadata. The real API container still exited `1` before liveness, and its durable startup marker remained `application-module-load`. This proves that neither the compiled entrypoint nor the separately loaded native authentication/data dependencies are the remaining blocker.
13. **Post-#1367 — bounded repository-local application graph isolation.** Canonical CI now runs the exact production image through `apps/api/scripts/runtime-app-module-load-probe.cjs` before the full boot. The probe wraps CommonJS module loading only for files resolved under `/app/apps/api/dist`, synchronously persists the last repository-local compiled module path before evaluation and requires `dist/app.module.js`. It never serializes a caught exception, stack, environment value, URI or secret. A successful graph load must persist exactly `app-module-load-ok`; a direct exit leaves the last `loading:<repository-local-path>` marker. The repository preflight locks the scope, synchronous persistence, fixed failure text and absence of raw exception/environment logging. The true production boot remains mandatory after this diagnostic gate.

## Current delivery

- Keep KMD-362 healthcheck definitions unchanged.
- Build API runtime dependencies with `pnpm --filter @knowme/api... build`.
- Compile the API through the dedicated deterministic `tsconfig.build.json` so `src/main.ts` is emitted as canonical `dist/main.js`.
- Start the API runtime image directly with `node apps/api/dist/main.js` as the non-root runtime user.
- Before full boot, prove the built image can load `argon2` and instantiate/disconnect `PrismaClient` under the same runtime image/user; preserve the Prisma `$disconnect` method literally through the container shell.
- Before full boot, require the production application graph in the exact image under the same guarded CI configuration. Persist only the last repository-local compiled module path if graph evaluation terminates early; require `app-module-load-ok` on success.
- Keep runtime dependency/application-graph loading inside bounded bootstrap phases and never serialize raw startup failures into CI evidence.
- Launch the exact API image built by canonical CI and require Docker `healthy` within a bounded 60-second window, then directly request `/health/live`.
- Launch the exact Web image and require the same bounded healthy transition plus direct liveness.
- Fail immediately if a container exits or becomes `unhealthy`; fail after the bounded window if it never becomes healthy.
- Always remove temporary containers.
- On API boot failure, persist bounded Docker state, startup phase marker, health history, liveness attempt and container logs, then upload the evidence only for the exact API boot failure.
- Keep production guards enabled and supply only isolated CI-scoped values required by those guards.

## CI-scoped production configuration

The runtime proof binds the GitHub Actions PostgreSQL service and test-only JWT material plus explicit CI release identity, one-instance rate limiting, trusted proxy, HTTP timeouts, reserved HTTPS CORS origin and synthetic S3 configuration. These values exist solely to exercise production validators. They are not production credentials, domains, storage proof, horizontal-scale evidence or deployment approval.

## Tests and merge gates

KMD-363 is complete only when CI for the **exact current PR head** passes:

1. supply-chain and package/lockfile preflights;
2. frozen dependency installation and production advisory threshold;
3. Prisma generation, migrations and zero datamodel drift;
4. monorepo build and repository unit tests;
5. frozen API image build and deterministic compiled-entrypoint proof;
6. non-root runtime identity and healthcheck metadata;
7. native runtime compatibility smoke for `argon2` and `PrismaClient`, including a shell-safe literal `$disconnect` call;
8. bounded application-graph load probe with `app-module-load-ok` under production guards;
9. actual API production image boot, healthy transition and direct `/health/live` success;
10. frozen Web image build, non-root identity, health metadata, actual boot and direct `/health/live` success;
11. Web E2E and API E2E;
12. no blocking review or unresolved review thread.

No earlier CI run can validate a newer head.

## Migration

No Prisma, user-data, public API-contract or client migration is required. KMD-363 changes runtime packaging, build determinism, compatibility proof, CI boot proof and startup diagnostics only.

## Rollback

Revert the KMD-363 commits. This restores KMD-362 behavior where CI builds the images and verifies healthcheck metadata without proving that the production commands, native runtime dependencies and application graph actually start successfully. No persistent-data rollback is required.

## Operational and proof boundary

A green KMD-363 proves only that the exact images built in GitHub Actions can load their guarded runtime dependencies/application graph, start and satisfy their liveness probes in that CI environment while production fail-closed configuration remains enabled.

It does **not** prove production orchestration, production secrets, production database durability, real object-storage connectivity/durability, production CORS/domain/TLS, network policies, alert delivery, backup restoration, supported-device physical behavior/accessibility, legal/privacy compliance, production deployment, or App Store / Google Play publication.

Canonical `main` branch protection is also external repository governance and must not be claimed complete until GitHub reports the required protection configuration.
