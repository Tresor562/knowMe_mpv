# KMD-219 — Backup retention release preflight

## Goal

Make the KMD-218 backup-retention policy an explicit market-release decision instead of silently relying on the pruning command's development defaults.

KMD-218 added a safe dry-run-first pruning mechanism with a retention window and minimum retained count. KMD-219 does not change pruning semantics. It makes production release readiness fail closed until those two policy values have been deliberately configured.

## Changes

- extends `scripts/backup-release-preflight.mjs`;
- requires `KNOWME_BACKUP_RETENTION_DAYS` for a market release;
- requires `KNOWME_BACKUP_KEEP_MINIMUM` for a market release;
- accepts only canonical positive decimal integers;
- bounds retention to 1..3650 days;
- bounds minimum retained backups to 1..1000;
- keeps the existing dedicated HMAC signing-key checks intact;
- documents the two values in `.env.example` without inventing production defaults;
- extends the root backup release-preflight tests because `pnpm test` already executes that suite.

## Why no production default

The pruning command may use development/operator defaults when invoked interactively, but market release configuration is different. The real retention period and minimum backup count depend on the approved RPO, storage topology, restore practice, legal/privacy obligations and business continuity policy.

KMD-219 therefore requires an explicit decision rather than treating `30` days and `3` backups as universally correct production policy.

## Validation

Automated coverage verifies:

- a valid signing key plus explicit bounded retention policy passes;
- a missing retention window fails;
- zero, negative, fractional, non-numeric and out-of-range retention values fail;
- a missing minimum retained count fails;
- zero, negative, fractional, non-numeric and out-of-range minimum counts fail;
- documented lower and upper bounds pass;
- existing signing-key isolation tests remain enforced;
- error messages continue to avoid disclosing secret values.

The repository merge gate remains production dependency audit, Prisma generation, `migrate deploy`, zero drift, complete monorepo build, root unit tests, Chromium Web E2E and PostgreSQL API E2E on the exact PR head.

## Migration

No Prisma migration and no persisted application-data migration are required.

Before a market release, operations/release owners must configure:

- `KNOWME_BACKUP_RETENTION_DAYS`;
- `KNOWME_BACKUP_KEEP_MINIMUM`.

Those values must reflect a real approved backup/recovery policy. Passing this preflight is configuration evidence only; it is not proof that pruning or backups are scheduled.

## Rollback

Revert KMD-219 to remove the release-preflight requirement. KMD-218 pruning remains available with its existing dry-run-first safety behavior. Rolling back this gate does not restore any backup artifacts previously deleted by an operator.

## External evidence still required

KMD-219 does **not** prove:

- that production backups are scheduled;
- that pruning is scheduled;
- that remote storage exists or is encrypted, immutable or replicated;
- that the configured values have legal/privacy approval;
- that the chosen values satisfy the actual RPO/RTO;
- that restore drills succeed in the target infrastructure;
- that deployment, physical-device validation, legal review or store publication is complete.

Those remain external release gates requiring real evidence.
