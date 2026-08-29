# KMD-322 — Harden release evidence apply CLI ingestion

## Status

Implemented on `feat/kmd-322-harden-evidence-apply-cli-reads`. Merge only after CI succeeds on the exact PR head.

## Problem

KMD-317 through KMD-321 moved retained manual evidence creation, preflight and batch/finalize loading onto the descriptor-bound retained-evidence safe reader. The standalone `release:evidence:item:apply` CLI still read its manifest, item, retained artifact, worksheet and human review receipt with direct `readFile()` calls. That left the apply path with weaker filesystem guarantees than the rest of the manual evidence pipeline.

## Delivery

- `release:evidence:item:apply` now ingests the release manifest and serialized evidence item through `readRetainedEvidenceFile()` before JSON parsing.
- Manual artifact, worksheet and review receipt reads in the same CLI now also use the shared safe reader before the human-review promotion preflight runs.
- The shared limit contract now includes a 4 MiB manifest ceiling. Existing limits remain 2 MiB for an item, 256 MiB for an artifact, 2 MiB for a worksheet and 1 MiB for a review receipt.
- All reads inherit the existing regular-file/no-symlink checks, `O_NOFOLLOW` where available, descriptor identity checks, bounded chunked reads and `(dev, ino, size, mtimeNs, ctimeNs)` stability checks before/after consumption.
- A CLI regression verifies a normal WEB_V1 apply succeeds and a symlinked serialized item is rejected before JSON ingestion.
- The regression is registered in the root `pnpm test` gate.

## Migration

No Prisma migration, API contract migration, user-data migration or manifest schema migration is required. Operators must provide regular files rather than symlinks for all standalone apply inputs and keep the manifest below 4 MiB.

## Rollback

Revert the KMD-322 commits. That restores direct `readFile()` ingestion in the standalone apply CLI and removes the manifest limit. Rollback weakens filesystem-ingestion protections and should only be used to recover from a demonstrated compatibility regression.

## Validation boundary

CI must validate the exact PR head before merge. This KMD does not claim physical iOS/Android validation, App Store or Google Play submission, legal/privacy approval, production deployment, or any other external evidence. Those remain external release gates that cannot be manufactured by repository automation.
