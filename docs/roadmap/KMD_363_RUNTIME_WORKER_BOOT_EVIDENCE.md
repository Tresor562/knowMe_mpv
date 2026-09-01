# KMD-363 — Runtime worker boot evidence

## CI #1380 finding

The exact candidate `94cd34f0027e0ef96474595e1ebe6c2b32741ed5` passed the KMD-363 supply-chain/configuration preflights, frozen installation, production dependency audit, Prisma generation/migrations/zero drift, monorepo build/tests, API image build, deterministic entrypoint proof, native `argon2` and `PrismaClient` smokes, bounded application-graph load, non-root identity and healthcheck metadata.

The real API production container then exited with code 1 while the bounded startup phase marker was `http-listen`. This is later than CI #1375: Nest dependency creation and route registration now complete.

The bounded runtime logs identify the next startup policy failure: `MediaQuarantineRetentionWorkerService` requires the production quarantine retention policy before its `OnModuleInit` hook can complete. The same lifecycle stage also contains production guards for quarantine retry policy and purge-alert delivery configuration.

## Correction

The real API boot proof now supplies isolated CI-only values for the complete media-worker startup policy:

- `MEDIA_QUARANTINE_INFECTED_RETENTION_DAYS=30`
- `MEDIA_QUARANTINE_UNAVAILABLE_RETENTION_DAYS=7`
- `MEDIA_QUARANTINE_RETRY_ENABLED=false`
- `MEDIA_QUARANTINE_RETRY_INTERVAL_MS=60000`
- `MEDIA_QUARANTINE_RETRY_BATCH_SIZE=10`
- `MEDIA_PURGE_ALERT_WEBHOOK_URL=https://alerts.ci.invalid/hook`
- `MEDIA_PURGE_ALERT_WEBHOOK_TOKEN=ci-only-media-purge-alert-token-0001`
- `MEDIA_PURGE_ALERT_WEBHOOK_TIMEOUT_MS=2000`

These are test configuration values only. They are not a legal retention decision, a production endpoint/token, delivery proof or deployment approval. KMD-239 explicitly requires real release retention durations to be chosen after legal/operational validation; KMD-363 does not override that boundary.

`runtime-media-workers-production-config-preflight.test.mjs` requires the CI bindings and independently checks that the underlying production policies remain fail-closed and bounded. In particular, disabling retry in CI does not bypass validation: production still requires the enable flag, interval and batch size to be explicitly valid before the worker may remain disabled.

## Validation required

This correction is not complete until one exact current PR head passes the full KMD-363 chain including the new preflight, real API healthy transition and direct liveness, real Web boot/liveness, Web E2E and API E2E.

## Rollback

Revert the media-worker CI binding commit and `runtime-media-workers-production-config-preflight.test.mjs`. Do not replace the correction by removing or weakening the production `OnModuleInit` guards in retention, retry or purge-alert services. No persistent-data migration or rollback is involved.

## Proof boundary

A green CI boot with these values proves only that the production image can initialize guarded worker lifecycle hooks in the isolated CI environment. It does not prove legally appropriate retention durations, real webhook delivery, production object-storage durability/connectivity, monitoring, backup restoration, production deployment or store publication.
