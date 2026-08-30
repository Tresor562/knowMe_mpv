# KMD-343 — Harden market-release evidence items directory enumeration

## Problem

The market-release evidence finalizer and batch-apply CLI already read each retained evidence item through the descriptor-bound `readRetainedEvidenceFile()` path, but both still enumerated `--items-dir` directly with `readdir()`. A symlink supplied as the terminal items-directory path could therefore redirect enumeration to a different directory before the hardened per-file reads began.

## Delivery

- Add a shared retained-evidence directory-listing helper used by both batch apply and finalization.
- Reject `--items-dir` when the terminal path is a symbolic link or is not a directory.
- Snapshot the directory device/inode identity before enumeration and verify the same directory identity immediately after enumeration.
- Fail closed when the directory changes while evidence filenames are being enumerated.
- Preserve deterministic `.json` filtering and ordering.
- Preserve the existing descriptor-bound, size-limited read of every evidence item after enumeration.
- Add CLI regression coverage proving both CLIs reject a symlinked items directory before evidence ingestion or artifact creation.

## Validation

The repository root test suite already includes `scripts/market-release-evidence-batch-apply.test.mjs` and `scripts/market-release-evidence-finalize.test.mjs`; KMD-343 extends both suites. Merge only after CI succeeds on the exact PR head SHA and all repository review gates are clear.

## Migration

No Prisma migration, user-data migration, API contract migration, evidence schema migration or operational data rewrite is required.

## Rollback

Revert the KMD-343 commits. No persistent-data rollback is required.

## Proof boundary

KMD-343 hardens the local filesystem boundary used to enumerate retained market-release evidence. It does not prove that any evidence is truthful, perform a production deployment, execute a real backup restoration, establish legal/privacy compliance, validate physical devices, or submit KnowMe to an app store. The per-file retained-evidence reader remains responsible for file-level no-symlink, bounded-read and identity/stability checks.
