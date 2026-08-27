# KMD-294 — Privacy, terms, and legal-review evidence binding

## Goal

Prevent an arbitrary retained file from becoming `privacy_terms_legal_review=VERIFIED` merely because it has a SHA-256 digest.

## Delivered

- Adds `pnpm release:privacy-legal:evidence:bind`.
- Parses the exact retained production review artifact bytes.
- Accepts only schema v1, `kind=knowme-privacy-terms-legal-review`, `status=PASSED`, and `environment=PRODUCTION`.
- Requires six separate recorded checks to be `PASSED`: privacy policy, terms, consent, data lifecycle, minors/age gate, and processor/subprocessor review.
- Requires canonical SHA-256 digests for the retained privacy policy, terms, consent notice, and legal-review record.
- Rejects unknown fields, malformed/future timestamps, malformed digests, and widened proof-boundary wording.
- Derives `verifiedAt` from the retained artifact observation.
- Hashes the exact retained artifact bytes through the canonical market-evidence builder.
- Produces only the `privacy_terms_legal_review` evidence item and remains subject to manifest signing, retained-bundle verification, expiry, and `check:market-ready`.

## Proof boundary

This is a schema, semantic, and byte-integrity binder only. CI fixtures are synthetic and must never be represented as legal approval. A real market release still requires an actual review by the responsible legal/privacy owner for the target deployment and jurisdiction(s), with retained artifacts. Product changes, policy changes, processor changes, or legal/regulatory changes can invalidate prior review and require revalidation.

The binder does not establish legal compliance, regulatory approval, enforceability of terms, age-assurance sufficiency, processor compliance, or continuing validity.

## Migration

No Prisma migration and no user-data change.

Adoption requires producing and retaining a real production review artifact with the exact schema-v1 contract and keeping the referenced reviewed documents/record available under the organization's evidence-retention process.

## Rollback

Revert KMD-294. The generic market-evidence item builder remains available, but release governance must not mark `privacy_terms_legal_review` as verified without an equivalent semantic review.

## Validation required before merge

- root tests including the KMD-294 binder suite;
- repository build;
- Prisma generate/migrate/drift checks;
- Chromium Web E2E;
- PostgreSQL API E2E;
- no claim that CI fixtures constitute legal review or legal compliance.
