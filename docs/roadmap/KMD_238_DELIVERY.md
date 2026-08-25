# KMD-238 — Media quarantine retry release hardening

## Goal

Prevent production and market-release configurations from silently falling back to retry-worker defaults when media quarantine retry settings are missing, malformed or ambiguous.

## Delivered

- Production startup now requires `MEDIA_QUARANTINE_RETRY_ENABLED` to be exactly `true` or `false`.
- Production startup requires explicit canonical `MEDIA_QUARANTINE_RETRY_INTERVAL_MS` and `MEDIA_QUARANTINE_RETRY_BATCH_SIZE` values.
- Retry interval remains bounded to 60,000–21,600,000 ms.
- Retry batch size remains bounded to 1–100.
- Malformed production settings fail closed instead of silently falling back to development defaults.
- Non-production behavior keeps conservative defaults for developer/test compatibility.
- A dedicated release preflight validates the same configuration contract and is wired into both root tests and `pnpm check:release`.

## Security and reliability boundary

This milestone does not enable retries by itself. `MEDIA_QUARANTINE_RETRY_ENABLED=false` remains a valid explicit production choice. When retries are enabled, KMD-235/236 eligibility, attempt caps, backoff, SHA-256 revalidation, quarantine state checks and the rule that only `CLEAN` can become `AVAILABLE` remain authoritative.

The preflight validates configuration syntax and bounds only. It is not evidence that the retry interval or batch size is appropriate for the real scanner provider capacity, latency, SLA or production traffic.

## Migration

No Prisma migration is required. Before deploying this milestone to production, explicitly configure:

- `MEDIA_QUARANTINE_RETRY_ENABLED=true|false`
- `MEDIA_QUARANTINE_RETRY_INTERVAL_MS` within 60,000–21,600,000
- `MEDIA_QUARANTINE_RETRY_BATCH_SIZE` within 1–100

Existing development/test environments may continue to rely on the conservative defaults.

## Rollback

Revert KMD-238. KMD-236 retry behavior remains available, but production would again be able to silently fall back when settings are malformed. Do not use that rollback to justify a market release with ambiguous retry configuration.

## External proof still required

KMD-238 does not remove the KMD-228 release blocker and does not prove:

- a validated production malware-scanning provider;
- production credentials or secret-manager configuration;
- egress/network controls;
- provider capacity, latency or SLA;
- distributed worker coordination for a future multi-instance topology;
- production alert delivery;
- real benign/EICAR exercises;
- analyst/quarantine operating procedures;
- production deployment or physical mobile validation.

## Merge gate

Merge only after the exact PR head passes dependency audit, Prisma generation, migration deploy, zero drift, monorepo build, root tests, Chromium Web E2E and PostgreSQL API E2E.
