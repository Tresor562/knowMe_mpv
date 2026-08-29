# KMD-323 — Harden batch release-evidence CLI ingestion

## Problem

After KMD-322 hardened the standalone item apply CLI, `release:evidence:batch:apply` still parsed its manifest and item JSON files through direct `readFile()` calls. That bypassed the descriptor-bound retained-evidence reader used by the rest of the manual evidence chain.

## Delivery

- The batch CLI now reads the unsigned release manifest through `readRetainedEvidenceFile()` with the existing 4 MiB manifest limit.
- Every JSON evidence item discovered in `--items-dir` is read through the same descriptor-bound reader with the existing 2 MiB item limit before JSON parsing.
- Existing protections therefore apply to batch ingestion: regular file only, symlink rejection, `O_NOFOLLOW` when available, bounded reads, and stability checks across `(dev, ino, size, mtimeNs, ctimeNs)` before/open/after read.
- The pure `applyMarketReleaseEvidenceBatch()` contract is unchanged.
- Existing FULL manual-evidence authorization remains fail-closed and continues to be rebuilt from retained proof + worksheet + human-review receipt in-process.

## Tests

The registered `scripts/market-release-evidence-batch-apply.test.mjs` suite now also executes the real CLI and verifies:

1. a complete WEB_V1 batch built from regular bounded files succeeds and leaves every evidence slot VERIFIED;
2. a symlinked manifest is rejected before JSON ingestion.

The test remains part of the root `pnpm test` gate; no new unregistered test entry is required.

## Migration

No Prisma migration, user-data migration, API contract change, manifest schema change, or operator directory-layout migration is required.

## Rollback

Revert the KMD-323 commit(s). This restores direct batch CLI file reads but does not alter persisted release evidence or application data. Any output already produced by the hardened path remains schema-compatible.

## Evidence boundary

This hardening only proves safer local ingestion of retained evidence files. It does not prove the truthfulness of physical iOS/Android validation, store submission, legal review, deployment, production operations, or any other real-world evidence. Those gates remain external and must not be claimed without retained proof.
