# KMD-330 — Harden manual evidence preflight CLI ingestion

## Why this milestone exists

The manual FULL-release evidence preflight still read `--file` with a direct `readFile()` before JSON parsing. That left this release-critical path outside the descriptor-bound retained-evidence reader already used by the surrounding evidence pipeline.

## Delivery

- `scripts/manual-release-evidence-preflight.mjs` now reads the worksheet through `readRetainedEvidenceFile()`.
- The existing shared worksheet ceiling of 2 MiB is enforced through `RETAINED_EVIDENCE_FILE_LIMITS.worksheet`.
- The preflight therefore inherits the shared regular-file-only, non-symlink, `O_NOFOLLOW` where available, bounded descriptor read, and `(dev, ino, size, mtimeNs, ctimeNs)` stability checks.
- Semantic worksheet validation and the explicit `certifiesValidation: false` boundary are unchanged.

## Tests

`manual-release-evidence-preflight.test.mjs` keeps its semantic coverage and adds real CLI coverage proving that:

1. a regular bounded completed worksheet can pass preflight; and
2. a worksheet supplied through a symlink is rejected before JSON ingestion.

The root test command already includes this registered test file.

## Migration

No Prisma migration, user-data migration, API contract migration, release-manifest schema migration, or operator-layout migration is required.

## Rollback

Revert the KMD-330 commits. No data rollback is required.

## Proof boundary

This milestone hardens how the CLI ingests a worksheet. It does **not** certify any physical-device validation, store submission, production deployment, legal review, privacy review, or other external release evidence. Those remain external proof obligations and must fail closed when absent.
