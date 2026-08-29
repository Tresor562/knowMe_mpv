# KMD-325 — Harden readiness report CLI manifest ingestion

## Goal

Close the remaining weak filesystem-ingestion path in the market release readiness reporter. The pure readiness assessment stays unchanged; only the CLI file boundary is hardened.

## Problem

`release:evidence:readiness` previously loaded its manifest with an unbounded `readFile()` call. That bypassed the shared retained-evidence reader already used by apply, batch, finalize, item creation, and manual promotion paths. A symlink, path replacement, in-place mutation, or oversized manifest could therefore reach JSON parsing through this reporting path.

## Delivery

The CLI now reads the release evidence manifest through `readRetainedEvidenceFile()` with the existing manifest ceiling of 4 MiB before JSON parsing.

This reuses the common protections already established for retained release evidence:

- regular files only;
- symbolic links rejected;
- `O_NOFOLLOW` where supported;
- descriptor-bound reads;
- bounded 64 KiB chunking;
- maximum-size enforcement before, during, and after read;
- `(dev, ino, size, mtimeNs, ctimeNs)` stability checks across open/read/close boundaries.

The readiness report remains informational. It does not authenticate external evidence and does not replace the authoritative market-ready gate.

## Tests

The existing readiness unit suite remains intact and now also executes the real CLI to prove:

1. a regular bounded WEB_V1 manifest is accepted and produces a complete readiness report;
2. a symlinked manifest is rejected before JSON ingestion and produces no readiness report on stdout.

The repository root test command already includes `market-release-evidence-readiness-report.test.mjs`, so no test registration change is required.

## Migration

No Prisma migration, user-data migration, API contract change, release manifest schema change, or operator directory-layout migration is required.

## Rollback

Revert the KMD-325 commits. This restores direct manifest reading only for the readiness reporter and does not alter stored data or manifest structure. Rolling back weakens filesystem-ingestion guarantees and should only be used if the shared retained-evidence reader itself is found defective.

## Proof boundary

Automated CI can validate code, unit tests, CLI behavior, build, and repository E2E gates available in GitHub Actions. This KMD does not claim completion of physical iOS/Android testing, App Store or Google Play submission, legal/privacy review, or production deployment without retained external evidence.
