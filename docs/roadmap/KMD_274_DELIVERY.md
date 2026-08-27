# KMD-274 — Market release bundle receipt authenticity

## Objective

Harden the KMD-273 bundle-verification receipt so that a retained receipt cannot be edited after generation and still be accepted as authentic.

KMD-273 already produced a SHA-256 over the exact receipt bytes, but that digest alone did not authenticate who produced the receipt. KMD-274 upgrades the receipt to schema v2 and authenticates its bounded semantic contents with HMAC-SHA-256 using the existing dedicated market-release evidence signing key and key id.

## Delivered behavior

- `release:evidence:bundle:receipt` now emits schema v2 receipts containing `receiptHmacSha256`.
- The HMAC is domain-separated from the manifest HMAC contract.
- The authenticated payload includes verification time, release commit/version/scope, signing-key id, manifest/digest paths and SHA-256 values, and the explicit proof boundary.
- `pnpm release:evidence:bundle:receipt:verify` validates the strict receipt schema, release identity, key id, timestamp, HMAC and exact receipt SHA-256.
- Receipt HMAC comparison is timing-safe.
- Unknown fields, old schema versions, future timestamps, weak keys and candidate identity mismatches fail closed.
- Receipt files remain exclusive-write artifacts with restrictive permissions where supported.

## Migration

No Prisma or user-data migration is required.

Operationally, new release verification receipts use schema v2. Historical schema v1 receipts remain historical records but are not accepted by the new authenticity verifier. Re-run the current bundle verifier and receipt generator if an authenticated receipt is required for an old release candidate and the original signed bundle artifacts are still retained.

## Rollback

Revert KMD-274 to restore KMD-273 schema v1 receipt generation and remove `release:evidence:bundle:receipt:verify`.

Do not rewrite existing schema v2 receipts as schema v1 during rollback; preserve them as release artifacts.

## Proof boundary

A valid receipt HMAC proves that the receipt contents were produced with the configured KnowMe market-release evidence signing key and have not been semantically modified since signing. It does not prove the external truthfulness of the evidence referenced by the signed release bundle.

The following still require real external proof and are not claimed by KMD-274: production DNS/TLS, deployment correctness, restore drills, monitoring/on-call delivery, legal/privacy review, account export/deletion exercises, moderation/support procedures, production antimalware validation, physical iOS/Android testing, store submission, or store publication.
