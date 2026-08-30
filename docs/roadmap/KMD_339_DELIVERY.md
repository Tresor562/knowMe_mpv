# KMD-339 — Harden PostgreSQL restore-drill manifest ingestion

## Problem

The isolated PostgreSQL restore-drill path still loaded the signed backup manifest through path-based `readFile()`. That left a recovery-critical input outside the descriptor-bound retained-evidence reader used by the hardened release-evidence toolchain and allowed a path replacement/symlink window before signature and digest validation.

## Delivery

- Route `${dump}.manifest.json` through `readRetainedEvidenceFile()` before JSON parsing.
- Keep the shared retained manifest ceiling (`RETAINED_EVIDENCE_FILE_LIMITS.manifest`, 4 MiB).
- Preserve the existing restore-drill confirmation phrase, target-isolation check, manifest signature verification, dump SHA-256 verification, RPO/RTO bounds, credential isolation, PostgreSQL integrity checks, proof boundary, and exclusive evidence output reservation.
- Add fail-closed coverage proving a symlinked backup manifest is rejected before any destructive restore command runs and before an evidence artifact can be reserved.

## Validation

The repository root `pnpm test` already includes `scripts/postgres-restore-drill.test.mjs`, so the new regression is exercised by the normal CI test gate. Merge only after CI succeeds on the exact PR head and review gates are clear.

## Migration

No Prisma migration, user-data migration, API contract migration, backup-manifest schema migration, or operator-layout migration is required.

## Rollback

Revert the KMD-339 commits. No persistent data rollback is required. Restored databases created by a real operator drill remain subject to the existing restore runbook and must not be treated as production data solely because this code path exists.

## Proof boundary

KMD-339 hardens how the automated restore drill ingests its signed backup manifest. It does not prove remote backup durability, successful production disaster recovery, business-data correctness, future RPO/RTO performance, or that a real restore drill has been executed against infrastructure during this change.
