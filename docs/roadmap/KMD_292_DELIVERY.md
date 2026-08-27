# KMD-292 — Data export/delete market-evidence binding

## Goal

Prevent the generic market-evidence builder from marking `data_export_delete_validation` as `VERIFIED` merely because an arbitrary retained file has a SHA-256 digest.

## Delivered

- `pnpm release:data-lifecycle:smoke:evidence:bind` parses the exact retained KMD-291 artifact bytes.
- The binder accepts only the exact schema-v1 contract and rejects unknown top-level/check fields.
- It requires `status=PASSED`, canonical production HTTPS origin, canonical observation time, canonical canary-id SHA-256, and the exact KMD-291 proof boundary.
- It requires successful ephemeral registration, account export, password-hash exclusion, account deletion, and rejected authentication after deletion.
- `exportFormatVersion` must be a positive integer.
- `verifiedAt` is derived from the retained smoke `observedAt`; operators cannot independently choose a different verification instant for this evidence type.
- The market evidence SHA-256 is calculated over the exact retained KMD-291 bytes through the canonical evidence-item builder.
- The resulting item is exclusively `data_export_delete_validation` and remains subject to scope, verifier, evidence URI, validity, manifest signing, bundle retention, and `check:market-ready`.

## Proof boundary

A semantically valid KMD-291 artifact proves only that the explicitly confirmed ephemeral canary flow passed at the recorded production origin. KMD-292 does not establish legal compliance, processor deletion, backup expiration, legal-hold handling, or truthfulness of an artifact that was not actually produced in the target environment.

CI fixtures are synthetic and must never be entered into a production release manifest as real evidence.

## Migration

No Prisma migration and no user-data change.

## Rollback

Revert KMD-292. KMD-291 remains available for production lifecycle smoke generation, and the generic market-evidence tools remain unchanged.

## Validation required before merge

- root tests including the KMD-292 semantic binder suite;
- repository build;
- Prisma generate/migrate/drift checks;
- Chromium Web E2E;
- PostgreSQL API E2E;
- no production-evidence claim from CI fixtures.
