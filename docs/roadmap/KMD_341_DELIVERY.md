# KMD-341 — Harden moderation/support drill retained input reads

## Problem

The production moderation/support/incident-operations drill rejected symlinks with `lstat()` but then reopened the runbook and incident record by pathname with `readFile()`. A path could therefore be replaced between validation and hashing/parsing, leaving a TOCTOU gap in release evidence generation.

## Delivery

- Route both runbook and incident-record inputs through `readRetainedEvidenceFile()`.
- Keep the historical 2 MiB per-input ceiling by reusing `RETAINED_EVIDENCE_FILE_LIMITS.item`.
- Preserve the historical non-empty input requirement and its operator-facing size error.
- Preserve canonical path checks, explicit `MODERATION_OPS_DRILL_COMPLETED` confirmation, exact six-check schema, production-only status, timestamp validation, SHA-256 binding, proof boundary, and exclusive output creation.
- Keep existing symlink rejection coverage and add a regression proving empty retained inputs remain rejected after migration to descriptor-bound reads.

## Validation

The repository root `pnpm test` already includes `scripts/moderation-support-incident-ops-drill.test.mjs`. Merge only after CI succeeds on the exact PR head and review gates are clear.

## Migration

No Prisma migration, user-data migration, API contract migration, evidence schema migration, or operator-layout migration is required.

## Rollback

Revert the KMD-341 commits. No persistent data rollback is required.

## Proof boundary

KMD-341 hardens ingestion of files supplied to the moderation/support incident-operations evidence builder. It does not prove that a real production drill occurred, that staffing or escalation obligations are satisfied, that legal compliance has been reviewed, or that future incident response will meet operational targets.
