# KMD-312 — Canonical evidence metadata at item application

## Goal

Fail closed earlier in the market-release evidence pipeline by enforcing the same canonical verifier and evidence-reference rules at evidence-item application time that the signed-manifest preflight already enforces later.

## Change

`release:evidence:item:apply` now rejects an evidence item before mutating the unsigned manifest when:

- `verifier` is empty, padded with whitespace, longer than 128 characters, or contains control characters;
- `evidenceRef` is not a canonical credential-free `https:` or `evidence:` URI;
- `evidenceRef` contains credentials, a query string, a fragment, control characters, leading/trailing whitespace, or falls outside the existing 8-2048 character boundary;
- `evidenceRef` has no hostname or uses an unsupported protocol such as `file:`.

These rules intentionally match the existing schema-v4 market-release preflight contract. KMD-312 moves rejection closer to ingestion rather than waiting until final signing/preflight.

The KMD-311 release binding for the four FULL manual physical/store items remains unchanged and continues to be stripped only after successful release identity validation.

## Validation

Regression tests cover:

- an existing valid WEB_V1 evidence item;
- valid FULL manual evidence with release binding;
- verifier leading whitespace;
- verifier control characters;
- evidence URI credentials;
- query parameters;
- fragments;
- unsupported protocols;
- existing release replay, signed-manifest, scope, stale validity, duplicate-slot, and pending-slot protections.

The item-apply suite is already included in the repository root `pnpm test` gate.

## Migration

No Prisma schema, database migration, API contract, user data, entitlement, Web, or Mobile migration is required.

Operationally, evidence items that previously relied on non-canonical verifier names or evidence references must be regenerated with the already-required canonical metadata before they can be applied.

## Rollback

Revert the KMD-312 commits. No database or user-data rollback is required.

Rollback would restore the previous behavior where malformed verifier/reference metadata could enter an unsigned manifest and fail only during final preflight. Prefer fixing any producer that emits malformed metadata rather than weakening this validation.

## Proof boundary

KMD-312 validates evidence metadata shape and transport safety only. It does not establish that a physical-device test, store submission, legal review, backup drill, production deployment, moderation exercise, or other external event actually occurred. Those claims still require retained real-world proof.
