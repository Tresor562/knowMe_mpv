# KMD-363 — Runtime worker boot evidence

## CI #1380 finding

The exact candidate `94cd34f0027e0ef96474595e1ebe6c2b32741ed5` passed the KMD-363 supply-chain/configuration preflights, frozen installation, production dependency audit, Prisma generation/migrations/zero drift, monorepo build/tests, API image build, deterministic entrypoint proof, native `argon2` and `PrismaClient` smokes, bounded application-graph load, non-root identity and healthcheck metadata.

The real API production container then exited with code 1 while the bounded startup phase marker was `http-listen`. This was later than CI #1375: Nest dependency creation and route registration completed.

The bounded runtime logs identified the next startup policy failure: `MediaQuarantineRetentionWorkerService` requires the production quarantine retention policy before its `OnModuleInit` hook can complete. The same lifecycle stage also contains production guards for quarantine retry policy and purge-alert delivery configuration.

## Correction

The real API boot proof supplies isolated CI-only values for the complete media-worker startup policy:

- `MEDIA_QUARANTINE_INFECTED_RETENTION_DAYS=30`
- `MEDIA_QUARANTINE_UNAVAILABLE_RETENTION_DAYS=7`
- `MEDIA_QUARANTINE_RETRY_ENABLED=false`
- `MEDIA_QUARANTINE_RETRY_INTERVAL_MS=60000`
- `MEDIA_QUARANTINE_RETRY_BATCH_SIZE=10`
- `MEDIA_PURGE_ALERT_WEBHOOK_URL=https://alerts.ci.invalid/hook`
- `MEDIA_PURGE_ALERT_WEBHOOK_TOKEN=ci-only-media-purge-alert-token-0001`
- `MEDIA_PURGE_ALERT_WEBHOOK_TIMEOUT_MS=2000`

These are test configuration values only. They are not a legal retention decision, a production endpoint/token, delivery proof or deployment approval. KMD-239 explicitly requires real release retention durations to be chosen after legal/operational validation; KMD-363 does not override that boundary.

`runtime-media-workers-production-config-preflight.test.mjs` requires the CI bindings and independently checks that the underlying production policies remain fail-closed and bounded. Disabling retry in CI does not bypass validation: production still requires the enable flag, interval and batch size to be explicitly valid before the worker may remain disabled.

## Exact-head validation

GitHub Actions CI #1383 completed successfully on exact candidate head `d4645c1ccf40e0e096d41237622c4d22d3ea35a7`.

The canonical `quality` job passed every KMD-363 merge gate on that exact SHA:

- supply-chain/configuration preflight;
- `pnpm install --frozen-lockfile`;
- production dependency audit;
- Prisma generation, migration deployment and zero schema drift;
- complete monorepo build and test suite;
- frozen API runtime image build;
- deterministic API entrypoint artifact proof;
- native `argon2` and `PrismaClient` runtime smokes;
- bounded application-graph loading probe;
- non-root API runtime identity and healthcheck metadata;
- real API production-container boot to Docker `healthy` plus direct liveness;
- frozen Web runtime image build;
- non-root Web runtime identity and healthcheck metadata;
- real Web production-container boot to Docker `healthy` plus direct liveness;
- Playwright Web E2E;
- PostgreSQL-backed API E2E.

The diagnostic artifact upload step was correctly skipped because the API boot succeeded. At the time this evidence was recorded, PR #466 had no submitted reviews and no unresolved review threads.

Any later commit to the PR, including documentation-only commits, requires a new exact-head CI success before merge; CI #1383 must not be reused as proof for a different SHA.

## Rollback

Revert the media-worker CI binding commit and `runtime-media-workers-production-config-preflight.test.mjs`. Do not replace the correction by removing or weakening the production `OnModuleInit` guards in retention, retry or purge-alert services. No persistent-data migration or rollback is involved.

If KMD-363 itself must be rolled back after merge, revert its merge commit as one unit; it adds CI/runtime proof and release packaging/diagnostic safeguards but no persistent schema migration.

## Proof boundary

A green CI boot with these values proves only that the exact production images can initialize their guarded lifecycle hooks and reach their liveness routes in the isolated CI environment. It does not prove legally appropriate retention durations, real webhook delivery, production object-storage durability/connectivity, production monitoring/alert delivery, backup restoration, real deployment/orchestrator behavior, physical-device validation, legal/privacy approval or store publication.
