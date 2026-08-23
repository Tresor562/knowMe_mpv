# KMD-208 — Account recovery audit retention boundary

## Goal

Close the privacy/operations gap introduced by the distributed recovery abuse budget without inventing a universal legal retention duration.

## Delivered

- adds `AccountRecoveryRetentionService` as an Auth-module maintenance worker;
- purges only `ACCOUNT_RECOVERY_ATTEMPT` / `ACCOUNT_RECOVERY` audit rows older than the explicitly configured retention cutoff;
- selects and deletes a bounded oldest-first batch per maintenance pass;
- deletion re-checks action, entity and cutoff in addition to candidate IDs so unrelated audit records cannot be broadened into the purge;
- no purge is scheduled when a retention duration has not been configured;
- market release preflight now requires an explicit integer `ACCOUNT_RECOVERY_ATTEMPT_RETENTION_DAYS` between 1 and 3650 days;
- market release preflight refuses disabling `ACCOUNT_RECOVERY_RETENTION_MAINTENANCE_ENABLED`;
- maintenance interval and batch size are bounded by preflight;
- `.env.example` exposes the configuration while deliberately leaving the retention-day value blank for an explicit release decision;
- unit tests cover missing-policy fail-safe behavior, cutoff calculation, bounded deletion and action/entity scoping;
- release-preflight tests cover missing/invalid retention policy, disabled maintenance and unsafe interval/batch values.

## Configuration

- `ACCOUNT_RECOVERY_ATTEMPT_RETENTION_DAYS`: required for market release; 1..3650; no repository default claiming legal validity;
- `ACCOUNT_RECOVERY_RETENTION_MAINTENANCE_ENABLED`: defaults to enabled at runtime and must remain enabled for market release;
- `ACCOUNT_RECOVERY_RETENTION_INTERVAL_MS`: defaults to 3,600,000 ms and is bounded to 60,000..86,400,000 ms for market release;
- `ACCOUNT_RECOVERY_RETENTION_BATCH_SIZE`: defaults to 500 and is bounded to 1..5000.

## Privacy boundary

This implementation provides data-minimization mechanics. It does **not** determine which retention duration is legally appropriate for every country, age group or operating context. The release owner must select and document the production duration after the applicable legal/privacy review. The repository preflight merely refuses to proceed without an explicit technical value.

## Reliability boundary

The in-process maintenance timer runs while an API instance is alive. Multiple instances may safely select overlapping candidates because the final `deleteMany` remains tightly scoped and deletion is idempotent. KMD-208 does not claim proof of an external scheduler, always-on infrastructure or a production execution history.

## Migration

No Prisma schema migration. The worker uses existing `AuditLog` rows introduced by KMD-207.

## Validation gate

Before merge, the exact head must pass:

1. production dependency audit;
2. Prisma generation;
3. clean `prisma migrate deploy`;
4. migration/datamodel zero-drift check;
5. complete monorepo build;
6. unit tests including recovery-retention behavior and release preflight;
7. Chromium Web E2E;
8. PostgreSQL API E2E.

No physical-device, production scheduler, legal-policy, deployment or store-publication validation is claimed by this KMD.

## Rollback

Revert the KMD-208 merge commit. No database rollback is required. Reverting removes the automatic purge and the production preflight requirement; it does not restore audit rows already physically deleted by a previously running retention worker.
