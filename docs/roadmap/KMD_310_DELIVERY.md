# KMD-310 — Manual release evidence target binding

## Goal

Prevent a KMD-309 human-review receipt created for one release from being reused to promote physical-device or store-submission evidence for another release.

## Change

`release:evidence:item:create` now requires canonical target release metadata (`--commit` and `--version`, or the existing canonical release environment variables) when creating the four FULL-scope manual evidence items:

- `ios_physical_validation`
- `android_physical_validation`
- `ios_store_submission`
- `android_store_submission`

The target commit must be a lowercase 40-character Git SHA and the target version must be canonical SemVer without build metadata. The KMD-309 review receipt must contain the exact same `releaseCommit` and `releaseVersion`.

The creation step fails closed when target metadata is missing, malformed, or differs from the reviewed release.

## Why this is required

KMD-309 bound review receipts to exact worksheet bytes and retained-proof bytes, but the generic evidence-item creator previously checked only that `releaseCommit` and `releaseVersion` were syntactically canonical. It did not compare them with the release for which the item was being created. That allowed an otherwise valid reviewed artifact from release A to be reused while building evidence for release B.

KMD-310 closes that inter-release replay path before the item can be applied to an unsigned market manifest.

## Validation

Regression tests cover:

- successful creation when receipt and target commit/version match;
- target commit mismatch;
- target version mismatch;
- missing target commit;
- missing target version;
- the existing artifact, worksheet, evidence ID, evidence URI, reviewer and review-decision drift protections.

The existing repository root test command already executes `scripts/market-release-evidence-item-create.test.mjs`, so the new cases are part of the normal CI quality gate.

## Migration

No Prisma schema, database migration, API contract, user data, entitlement, permission, or client migration is required.

Operationally, callers of `release:evidence:item:create` for the four manual FULL criteria must now provide the target release commit and version. Existing release environment variables remain supported.

## Rollback

Revert the KMD-310 commits. No data rollback is necessary.

Rollback would reopen the cross-release replay gap, so it should only be used to recover from an implementation regression and followed by a corrected fail-closed release binding.

## Proof boundary

This change does **not** prove that physical iOS/Android testing or App Store/Google Play submission occurred. It only proves that an item promoted through this code path is derived from a KMD-309 review receipt bound to the same release commit/version requested by the operator.

Actual device tests, legal review, production validation and store publication remain external evidence requirements and must never be claimed without real retained proof.
