# KMD-275 — Release receipt-to-bundle reverification

## Goal

Ensure an authenticated KMD-274 verification receipt is still bound to the exact retained signed market-release manifest and digest bytes before it is relied on later.

## Delivered

- `pnpm release:evidence:bundle:receipt:reverify`
- revalidates the receipt HMAC and candidate identity;
- revalidates the signed bundle itself through the canonical KMD-272 verifier;
- requires the retained manifest and digest paths to match the authenticated receipt;
- recomputes SHA-256 over the exact manifest and digest bytes and compares them with the receipt;
- verifies receipt scope against the retained signed manifest;
- rejects tampered, moved/substituted, malformed, or candidate-mismatched artifacts;
- root regression coverage.

## Migration

No Prisma or user-data migration is required. Existing valid schema-v2 KMD-274 receipts can be reverified when their exact retained manifest and digest artifacts remain available.

## Rollback

Revert KMD-275 to remove the reverification command and its tests. KMD-272 bundle verification and KMD-274 receipt authenticity remain independently available.

## Proof boundary

Successful reverification proves that the authenticated receipt still corresponds to the exact retained signed bundle bytes and candidate identity. It does not prove the truthfulness of external evidence, production deployment, DNS/TLS, restore drills, monitoring/on-call, legal/privacy review, data export/deletion, moderation/support readiness, antimalware validation, physical mobile testing, or store submission/publication.
