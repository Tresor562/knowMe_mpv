# KMD-324 — Harden final release-evidence CLI ingestion

## Goal

Close the remaining filesystem-ingestion gap in the official `release:evidence:finalize` operator path. KMD-322 hardened standalone apply, KMD-323 hardened batch apply, while finalize still parsed its manifest and discovered item JSON files with direct `readFile()` calls.

## Delivered changes

- `scripts/market-release-evidence-finalize.mjs` now reads the unsigned manifest through the shared `readRetainedEvidenceFile()` path before JSON parsing.
- Every evidence item discovered in `--items-dir` is read through the same shared descriptor-bound reader before JSON parsing.
- The existing file ceilings are reused rather than duplicated:
  - manifest: `RETAINED_EVIDENCE_FILE_LIMITS.manifest` (4 MiB),
  - item: `RETAINED_EVIDENCE_FILE_LIMITS.item` (2 MiB).
- The finalize CLI therefore inherits the established retained-evidence protections: regular-file enforcement, symlink refusal, `O_NOFOLLOW` when supported, bounded chunked reads, descriptor binding, and stability checks for device/inode/size/mtime/ctime during ingestion.
- Final output reservation remains unchanged and still uses exclusive `wx` creation for both the signed manifest and digest record.

## Tests

`market-release-evidence-finalize.test.mjs` now additionally exercises the real CLI:

1. regular WEB_V1 manifest + item files finalize successfully and emit both signed manifest and digest;
2. a symlinked manifest is rejected before JSON ingestion and neither output artifact is created.

The pre-existing finalize/sign/revalidate, digest-integrity, atomic pair-write, mismatch, FULL manual authorization, and fail-closed tests remain in place.

## Migration

No Prisma migration, API migration, user-data migration, manifest-schema migration, or operator directory-layout migration is required.

## Rollback

Revert the KMD-324 commits. This would restore direct `readFile()` ingestion in the finalize CLI and therefore re-open the symlink/TOCTOU/unbounded-read asymmetry relative to the other hardened release-evidence operator paths. No data rollback is required.

## Evidence boundary

This milestone hardens local ingestion mechanics only. It does not prove the truth of physical iOS/Android validation, App Store submission, Google Play submission, legal review, privacy review, or production deployment. Those claims remain valid only when backed by retained real-world evidence and the existing manual-review authorization chain.
