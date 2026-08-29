# KMD-329 — Harden PostgreSQL restore evidence binder ingestion

## Status

Implemented on the dedicated KMD-329 branch. Merge only after repository CI succeeds on the exact branch head and no blocking review thread remains.

## Problem closed

The `backup_restore_drill` semantic evidence binder still loaded its retained restore-drill artifact with a direct `readFile()` call. That left this release-critical path outside the descriptor-bound retained-evidence reader already used by the newer evidence creation, apply, finalize, readiness, receipt, and review paths.

A retained backup/restore proof must fail closed if the input is a symlink, is replaced while opening, mutates while being read, or exceeds the repository's explicit retained-artifact size ceiling.

## Delivery

`scripts/postgres-restore-drill-evidence-binding.mjs` now reads `--artifact` through `readRetainedEvidenceFile()` before JSON parsing or semantic validation.

The binder reuses `RETAINED_EVIDENCE_FILE_LIMITS.artifact` (256 MiB), so it inherits the shared guarantees:

- regular files only;
- symlink rejection;
- `O_NOFOLLOW` where supported;
- descriptor-bound bounded reads;
- size checks before, during, and after the read;
- `(dev, ino, size, mtimeNs, ctimeNs)` stability checks across open/read/close boundaries;
- fail-closed behavior if the retained proof changes during ingestion.

The semantic restore-drill contract, RPO/RTO checks, evidence item shape, verifier/ref contract, and release scope requirements are unchanged.

## Tests

The existing `scripts/postgres-restore-drill-evidence-binding.test.mjs` suite now additionally exercises the real CLI:

1. a regular retained restore artifact successfully creates a VERIFIED `backup_restore_drill` evidence item;
2. a symlinked retained restore artifact is rejected before JSON ingestion and no output evidence item is created.

Existing semantic validation coverage is preserved.

## Migration

No Prisma schema migration, user-data migration, API migration, manifest-schema migration, or operator-layout migration is required.

## Rollback

Revert the KMD-329 commits. This restores the former direct `readFile()` behavior without changing persisted product data or release manifest schemas. Rolling back weakens retained-proof ingestion safety and should only be done to diagnose a regression.

## Proof boundary

This KMD hardens how a retained restore-drill artifact is ingested. It does **not** prove that a real production backup was restored, that production RPO/RTO objectives were met, or that disaster recovery was physically exercised. Those claims still require retained external evidence from an actual drill and must not be inferred from automated tests alone.
