# KMD-309 — Worksheet-bound manual evidence chain

## Goal

Close the traceability gap between the completed manual release worksheet reviewed by a human and the later generic promotion of FULL-scope physical-device/store evidence.

KMD-307/308 already bound promotion to the retained proof bytes and human-review receipt. They did not bind the receipt to the exact worksheet bytes that were reviewed. A worksheet file could therefore be replaced after review without the generic promotion step detecting that change.

## Change

The manual review receipt is upgraded to schema version 2.

`release:evidence:manual:review` now:

- requires the exact worksheet bytes in addition to the parsed worksheet object;
- verifies those bytes decode to the same worksheet object that passed KMD-306 preflight;
- records `reviewedWorksheet.sha256`, calculated over the exact worksheet file bytes;
- continues to hash the exact retained external-proof artifact bytes;
- remains explicitly non-certifying with `certifiesExternalValidation: false`.

`release:evidence:item:create` now requires `--worksheet <worksheet.json>` for the four generic FULL-scope evidence IDs and fails closed unless:

- the KMD-309 review receipt uses schema version 2;
- `reviewedWorksheet.sha256` is a canonical lowercase SHA-256;
- the SHA-256 of the supplied worksheet bytes exactly matches the reviewed worksheet digest;
- the retained proof bytes, evidence URI, evidence ID and reviewer still match the review receipt;
- all existing KMD-308 scope and semantic-binder restrictions remain satisfied.

## Operator flow

1. Generate and complete the KMD-305 worksheet from real external validation evidence.
2. Pass KMD-306 preflight.
3. Retain the exact worksheet file and exact external-proof artifact.
4. Run the manual human-review receipt command against those exact files.
5. Preserve the resulting schema-v2 receipt, worksheet and retained proof together.
6. Promote with `release:evidence:item:create`, supplying `--artifact`, `--worksheet` and `--review-receipt` together.
7. Apply the resulting VERIFIED item to the unsigned manifest, finalize/sign the manifest, and run the market-ready gate.

Any byte-level change to the reviewed worksheet requires a new human review receipt.

## Tests

Regression coverage verifies:

- schema-v2 receipts contain the exact worksheet SHA-256;
- worksheet bytes must decode to the same preflighted worksheet object;
- generic promotion accepts the exact reviewed worksheet;
- missing worksheet bytes fail closed;
- changed worksheet bytes fail promotion;
- retained-proof digest, evidence ID, URI, reviewer and review decision drift remain rejected.

The affected test files are already part of the repository root test gate.

## Migration

No Prisma migration and no user-data migration.

Operational migration only: old schema-v1 manual review receipts are intentionally no longer accepted for new generic FULL-scope promotion. Operators must regenerate a human-review receipt from the completed worksheet and retained proof using the KMD-309 tooling.

## Rollback

Revert KMD-309 to restore schema-v1 receipt acceptance and remove the worksheet byte requirement from generic promotion. Database state, user data, existing manifests and retained proof artifacts are unchanged.

Do not use rollback to bypass evidence traceability for a production release.

## Proof boundary

KMD-309 does **not** prove that an iOS/Android physical test occurred, that an App Store/Google Play submission occurred, or that the human reviewer actually performed the external validation. It only makes the software evidence chain detect replacement of the worksheet or retained proof after review.

Real device testing, store-console evidence and human accountability remain external requirements and must not be marked complete without real retained evidence.
