# KMD-368 — Restore migration integrity and evidence alignment

## Goal

Strengthen KnowMe's release-critical PostgreSQL restore drill so a restored database cannot pass merely because `_prisma_migrations` exists. The generated restore evidence and the market-release evidence binder must also use the same canonical schema.

## Scope

- Restore drill now records and requires at least one successfully applied Prisma migration.
- Restore drill rejects any migration row that is still unfinished (`finished_at IS NULL` and `rolled_back_at IS NULL`).
- Restore evidence schema advances to v3 and records `publicTableCount`, `appliedMigrationCount`, and `unfinishedMigrationCount`.
- The `backup_restore_drill` market-evidence binder is aligned to the exact v3 artifact shape and rejects legacy v2/incomplete migration-state evidence.
- Existing restore isolation, signed-manifest verification, checksum verification, RPO/RTO enforcement, non-overwrite behavior, secret handling, and retained-artifact safety remain mandatory.

## Tests

- `scripts/postgres-restore-drill.test.mjs`
  - accepts canonical migration-state evidence;
  - rejects zero applied migrations;
  - rejects unfinished migrations;
  - verifies v3 evidence and retained secret safety.
- `scripts/postgres-restore-drill-evidence-binding.test.mjs`
  - accepts only canonical v3 restore evidence;
  - rejects legacy v2 artifacts;
  - rejects unfinished/empty migration state;
  - retains existing semantic and symlink-safety checks.
- Canonical repository CI must pass on the exact PR head before merge.

## Migrations

No Prisma schema/database migration is introduced by KMD-368. The change only inspects Prisma's existing `_prisma_migrations` metadata during an isolated restore drill.

## Rollback

Revert the KMD-368 commit(s). This restores the previous schema-v2 restore evidence and binder. Do not reuse a v3 artifact with an older binder after rollback.

## Proof boundary

KMD-368 strengthens automated isolated restore evidence. It does **not** prove production backup durability, production restore execution, complete business-data correctness, physical-device behavior, legal/privacy review, production monitoring, production orchestration, or store publication. A real production backup/restore drill still requires direct operational evidence before release claims are made.
