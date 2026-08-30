# KMD-344 — Harden FULL manual evidence chain directories

## Problem

The FULL release-evidence chain already loaded each retained artifact, worksheet, and human-review receipt through the descriptor-bound retained-evidence reader. However, `--manual-chain-dir` itself and each per-evidence subdirectory were still accepted as ordinary path components. A terminal directory symlink could therefore redirect the retained manual evidence chain before the hardened file-level reads began.

## Delivery

- Extend the shared retained-evidence directory helper with reusable directory identity snapshots and stability assertions.
- Require the manual release evidence chain root to be a real directory and not a symbolic link.
- Require every per-evidence directory (`ios_physical_validation`, `android_physical_validation`, `ios_store_submission`, `android_store_submission`) to be a real directory and not a symbolic link.
- Verify each per-evidence directory identity after its artifact, worksheet, and review receipt have been read.
- Verify the root chain directory identity again after all manual evidence authorizations are produced.
- Preserve all existing file-level bounded reads, no-symlink rules, digest checks, release commit/version binding, worksheet binding, review-receipt validation, and process-local authorization semantics.

## Tests

The existing `manual-release-evidence-chain-loader.test.mjs` suite is extended to prove that:

1. a symlinked `--manual-chain-dir` is rejected before retained file ingestion;
2. a symlinked per-evidence directory is rejected before retained file ingestion;
3. the existing successful reviewed-chain flow, file-symlink rejection, oversized review metadata rejection, and authorization validation remain unchanged.

Merge only after the repository CI succeeds on the exact PR head SHA and all review gates are clear.

## Migration

No Prisma migration, user-data migration, API contract change, release evidence schema migration, or retained artifact rewrite is required.

## Rollback

Revert the KMD-344 commits. No persistent data rollback is required. Rolling back reopens the directory-level symlink boundary while leaving the existing file-level retained-evidence reader protections in place.

## Proof boundary

KMD-344 hardens local filesystem traversal for the FULL manual release evidence chain. It does not certify that physical iOS/Android validation happened, that a store submission occurred, that legal/privacy review is complete, or that any production deployment or restore was executed. Those claims still require retained real-world evidence and the existing human-review/release-binding gates.
