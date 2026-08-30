# KMD-340 — Harden market-release evidence preflight manifest ingestion

## Problem

The final market-readiness preflight still loaded the signed release-evidence manifest through path-based `readFile()`. That left the release gate itself outside the descriptor-bound retained-evidence reader already used by the surrounding hardened evidence tooling, allowing a path replacement/symlink window before HMAC, release binding, validity and evidence checks.

## Delivery

- Route `--file` / `KNOWME_RELEASE_EVIDENCE_FILE` through `readRetainedEvidenceFile()`.
- Keep the shared retained manifest ceiling (`RETAINED_EVIDENCE_FILE_LIMITS.manifest`, 4 MiB).
- Preserve schema version 4, exact release commit/version binding, signing-key identity, HMAC authentication, evidence allowlists, validity deadlines, proof metadata and WEB_V1/FULL scope requirements.
- Add real CLI coverage proving a regular bounded signed manifest still passes.
- Add fail-closed CLI coverage proving a symlinked manifest is rejected before JSON/HMAC readiness evaluation.

## Validation

The repository root `pnpm test` already includes `scripts/market-release-evidence-preflight.test.mjs`, so both new CLI regressions are exercised by the normal CI test gate. Merge only after CI succeeds on the exact PR head and review gates are clear.

## Migration

No Prisma migration, user-data migration, API contract migration, release-evidence schema migration, signing-key rotation or operator-layout migration is required.

## Rollback

Revert the KMD-340 commits. No persistent data rollback is required.

## Proof boundary

KMD-340 hardens how the final market-release preflight reads its retained manifest. It does not turn pending evidence into VERIFIED evidence and does not prove production deployment, backup recovery, external monitoring, legal/privacy review, physical-device validation, or App Store / Google Play submission.
