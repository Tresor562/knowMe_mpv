# KMD-338 — Harden market release action-plan manifest ingestion

## Problem

The launch-readiness action-plan CLI still read its retained market-release manifest through path-based `readFile()`. That left a release-governance path outside the descriptor-bound retained-evidence reader already used by the hardened release evidence tooling.

## Delivery

- Route `--file` / `KNOWME_RELEASE_EVIDENCE_FILE` through `readRetainedEvidenceFile()`.
- Keep the shared retained manifest ceiling (`RETAINED_EVIDENCE_FILE_LIMITS.manifest`, 4 MiB).
- Preserve action-plan schema version 3, blocker ordering, proof boundaries, real-world/manual validation requirements, and nonzero exit status for incomplete readiness.
- Add real CLI coverage for a regular bounded retained manifest.
- Add fail-closed CLI coverage for a symlinked manifest before JSON ingestion.

## Validation

The repository root `pnpm test` already includes `scripts/market-release-evidence-action-plan.test.mjs`, so the new CLI regressions are exercised by the normal CI test gate. Merge only after CI succeeds on the exact PR head and review gates are clear.

## Migration

No Prisma migration, user-data migration, API contract migration, market-release manifest-schema migration, or operator-layout migration is required.

## Rollback

Revert the KMD-338 commits. No persistent data rollback is required.

## Proof boundary

KMD-338 hardens how the action-plan CLI ingests the retained release-evidence manifest. It does not make pending evidence VERIFIED and does not prove production deployment, external monitoring, legal/privacy review, physical-device validation, operational drills, backup restoration, or App Store / Google Play submission.
