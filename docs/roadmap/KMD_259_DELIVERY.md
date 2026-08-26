# KMD-259 — Market release evidence strict schema

## Objective

Make the market-readiness evidence contract fail closed on data that the validator does not explicitly understand.

## Delivered boundary

- Rejects unknown top-level manifest fields.
- Rejects unknown fields inside each evidence item.
- Rejects evidence ids that are not part of the selected `WEB_V1` or `FULL` scope.
- Preserves the existing schema-v4 HMAC, commit, version, signing-key-id, expiry and artifact SHA-256 checks.
- Keeps the KMD-258 signer compatible with the documented exact schema.

This prevents a signed manifest from carrying unvalidated fields or additional evidence ids that operators could mistakenly interpret as release-authoritative even though the release gate ignores their semantics.

## Tests

A dedicated root test suite verifies:

- unknown top-level fields fail even after a valid re-sign;
- unknown evidence fields fail even after a valid re-sign;
- scope-inappropriate evidence ids fail;
- the exact documented `WEB_V1` contract still passes;
- the exact documented `FULL` contract still passes.

## Migration

No Prisma migration is required. Existing valid schema-v4 manifests that contain only documented fields remain compatible. Any local tooling that previously injected extra fields must stop doing so or retain that metadata outside the release-authoritative manifest.

## Rollback

Revert KMD-259. This restores the prior permissive handling of unknown fields without changing stored product data or the HMAC algorithm.

## Proof boundaries

Strict schema validation only proves that the release gate interprets every field present in the signed manifest. It does not prove that external evidence is truthful, that a human/legal/device validation occurred, that production infrastructure matches the evidence, or that stores accepted/published a release.
