# KMD-342 — Harden market-release bundle receipt verification read

## Problem

The market-release bundle verification CLI still reopened its retained verification receipt directly by pathname with `readFile()`. That left this final release-evidence verification boundary outside the descriptor-bound retained-evidence read policy already applied to the surrounding market-readiness pipeline.

## Delivery

- Replace the direct path-based receipt read with `readRetainedEvidenceFile()`.
- Reuse the shared `bundleReceipt` size ceiling.
- Preserve the existing 64 KiB semantic receipt limit enforced by `verifyMarketReleaseEvidenceBundleReceipt()`.
- Preserve exact schema validation, candidate commit/version binding, signing-key-id binding, timestamp checks, HMAC verification, proof boundary and SHA-256 reporting.
- Add CLI regression coverage proving a symlinked receipt is rejected before JSON or HMAC verification.

## Validation

The repository root test suite includes `scripts/market-release-evidence-bundle-receipt-verify.test.mjs`. Merge only after CI succeeds on the exact PR head SHA and all review gates are clear.

## Migration

No Prisma migration, user-data migration, API contract migration, evidence schema migration or operational data rewrite is required.

## Rollback

Revert the KMD-342 commits. No persistent-data rollback is required.

## Proof boundary

KMD-342 hardens local ingestion of an already-produced authenticated release-evidence verification receipt. It does not create market-readiness evidence, perform a production deployment, prove a backup restoration, establish legal compliance, validate physical devices, or submit KnowMe to an app store.
