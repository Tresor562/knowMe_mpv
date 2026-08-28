# KMD-311 — Serialized manual evidence release binding

## Goal

Close the remaining cross-release replay gap after KMD-310 by carrying the target release identity on each serialized physical-device or store-submission evidence item until the item is applied to the unsigned market manifest.

## Change

The four manual FULL-scope evidence items now serialize two transport-time binding fields:

- `releaseCommit`
- `releaseVersion`

Affected evidence IDs:

- `ios_physical_validation`
- `android_physical_validation`
- `ios_store_submission`
- `android_store_submission`

`release:evidence:item:create` only emits these fields after the KMD-309 human-review receipt has passed the KMD-310 exact target-release checks.

`release:evidence:item:apply` now requires those fields for the four manual evidence IDs and rejects the item when either field is missing, malformed, or differs from the target manifest release.

Batch application and finalization reuse that same fail-closed item application path. FULL batch/finalize inputs therefore must carry the release binding on each physical/store evidence item; they do not receive a compatibility exception.

The two binding fields are transport-only. After a successful equality check they are stripped before the evidence item is inserted into the schema-v4 market manifest. This preserves the existing signed manifest schema while still preventing a serialized item produced for release A from being replayed into release B.

Common evidence items produced by dedicated semantic binders retain their existing exact seven-field contract and cannot acquire these transport-only fields.

## Validation

Regression coverage verifies that:

- generic manual evidence creation serializes the exact release commit and version;
- low-level semantic evidence items remain unchanged;
- FULL manual evidence applies when the serialized release binding exactly matches the target release;
- FULL batch application and finalization accept correctly release-bound manual items and strip the transport-only fields before manifest persistence/signing;
- batch/finalize reject legacy manual items missing the serialized binding;
- an item bound to another commit is rejected;
- an item bound to another version is rejected;
- an unbound legacy manual item is rejected rather than silently accepted;
- the transport-only fields are removed before insertion into the schema-v4 manifest;
- existing common evidence and production-smoke compatibility behavior remains unchanged.

The item-create, item-apply, batch-apply, and finalize test suites are part of the repository root `pnpm test` quality gate.

CI run #1094 exposed stale FULL test fixtures in the batch/finalize suites: those fixtures still constructed the four manual items with the pre-KMD-311 seven-field shape. The production enforcement behaved correctly and rejected them. The fixtures were updated to carry the required release binding, with explicit regression tests proving that legacy unbound manual items remain rejected. No runtime enforcement was weakened to make the tests pass.

## Migration

No Prisma schema, database migration, API contract, user data, entitlement, permission, Web, or Mobile migration is required.

Operationally, any manual FULL evidence item serialized before KMD-311 is intentionally incompatible with the stricter apply step because it lacks the release binding. Regenerate the item from its retained proof, reviewed worksheet, and KMD-309 receipt for the actual target release.

## Rollback

Revert the KMD-311 commits. No database or user-data rollback is required.

Rollback would restore acceptance of manual evidence items that do not carry their reviewed release identity through serialization, reopening the cross-release replay gap. Use rollback only to recover from an implementation regression and replace it with an equivalent fail-closed binding.

## Proof boundary

KMD-311 does not prove that physical iOS/Android validation or App Store/Google Play submission occurred. It only preserves and enforces the already-reviewed release identity between manual evidence creation and manifest application.

Physical-device testing, store-console activity, legal review, production validation, deployment, and publication remain external evidence requirements and must not be claimed without retained real-world proof.
