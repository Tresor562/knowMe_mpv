# KMD-313 — Manual release evidence promotion preflight

## Goal

Close the gap between the KMD-309 human review chain and the serialized FULL manual evidence item before that item is applied to a market-release manifest.

KMD-311 binds serialized manual evidence to the target release and KMD-312 validates canonical metadata at ingestion. KMD-313 adds a deterministic reconstruction preflight so operators can prove that the exact serialized item still matches the reviewed worksheet, review receipt, retained proof bytes, and target release.

## Command

```bash
pnpm release:evidence:manual:promotion:preflight -- \
  --item <verified-item.json> \
  --artifact <retained-proof> \
  --worksheet <worksheet.json> \
  --review-receipt <review-receipt.json> \
  --commit <release-commit> \
  --version <release-version>
```

The release commit/version may also come from the canonical release environment variables already used by the release tooling.

## Contract

The preflight accepts only the four FULL manual evidence ids:

- `ios_physical_validation`
- `android_physical_validation`
- `ios_store_submission`
- `android_store_submission`

It reconstructs the expected item through the same KMD-308/309 promotion constructor. That constructor revalidates the human-review receipt, reviewed worksheet digest, retained proof digest/URI, reviewer identity, release commit/version, timestamps, and scope. The reconstructed item must then be byte-for-byte equivalent at the JSON data-model level to the supplied item.

The preflight therefore rejects post-review drift such as a changed verifier, evidence URI, proof digest, release binding, worksheet, retained proof, review decision, or target release.

## Proof boundary

Passing this preflight does **not** certify that a physical iOS/Android test or an App Store/Google Play submission actually occurred. Those remain external validations requiring retained real-world proof.

This KMD also does not yet make the preflight impossible to bypass by calling lower-level apply/batch/finalize APIs directly. The next enforcement block should wire this reconstruction contract into those ingestion paths after the standalone contract is proven by CI.

## Migration

No Prisma migration, user-data migration, API schema migration, or product-data rewrite is required.

## Rollback

Rollback consists of reverting the KMD-313 script, its root test registration, and this document. Existing KMD-305→312 evidence artifacts remain unchanged.
