# KMD-328 — Harden manual human-review receipt CLI retained-file ingestion

## Status

Implementation branch: `feat/kmd-328-harden-human-review-receipt-cli-reads`

Merge only after CI succeeds on the exact branch head and GitHub reports the PR mergeable.

## Problem

After KMD-317 through KMD-327 hardened the main retained release-evidence ingestion paths, `scripts/manual-release-evidence-review-receipt.mjs` still loaded the human-reviewed worksheet and retained artifact with direct `readFile()` calls. That left the receipt-creation CLI outside the common protections against symlinks, unbounded inputs, path replacement, and in-place mutation during reads.

This is a release-integrity gap because the receipt binds hashes to the bytes read by this CLI.

## Delivery

The CLI now reads both retained inputs through `readRetainedEvidenceFile()` before JSON parsing or receipt creation.

Explicit existing limits are reused:

- worksheet: 2 MiB;
- retained artifact: 256 MiB.

The shared reader therefore enforces regular non-symlink files, `O_NOFOLLOW` when available, descriptor-bound bounded reads, pre/open/post identity checks, and `(dev, ino, size, mtimeNs, ctimeNs)` stability checks.

Receipt semantics are unchanged. A human-review receipt still records traceability only and does not certify that physical-device validation, store submission, legal review, privacy review, or production deployment actually occurred.

## Tests

The existing `manual-release-evidence-review-receipt.test.mjs` remains in the root `pnpm test` command and now includes CLI regressions that:

1. create a valid receipt from regular bounded worksheet/artifact files;
2. reject a symlinked worksheet before JSON ingestion.

Existing unit coverage for worksheet preflight, exact worksheet-byte binding, artifact digest binding, canonical reviewer/id validation, and timestamp checks remains intact.

## Migration

No Prisma migration, user-data migration, API contract migration, release-manifest schema change, or operator-layout migration is required.

## Rollback

Revert the KMD-328 commits. No database rollback is needed. Reverting would restore direct filesystem reads and therefore remove the added release-integrity protections.

## Evidence boundary

Automated CI can validate code behavior, but KMD-328 does not create or claim external evidence. Physical iOS/Android validation, App Store / Google Play submission, legal/privacy approval, and production deployment remain external release gates and must only be marked complete when independently evidenced.
