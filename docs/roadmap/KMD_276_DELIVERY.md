# KMD-276 — Release receipt freshness guard

## Goal

Prevent a cryptographically authentic market-release verification receipt from being relied on indefinitely without a fresh reverification of the retained signed manifest and digest bundle.

## Delivery

`pnpm release:evidence:bundle:receipt:reverify` now requires an explicit `--max-age-hours <hours>` value.

The CLI fails closed unless the value is a canonical positive integer between 1 and 8760 hours. During reverification, the authenticated receipt's `verifiedAt` timestamp is compared with the current verification time. A receipt older than the selected freshness window is rejected even when its HMAC and retained bundle bytes are otherwise valid.

The exact boundary is inclusive: a receipt exactly as old as the configured maximum remains valid; anything older is rejected.

## Why the value is not hard-coded

KnowMe does not invent a universal operational or legal freshness requirement. Release operators must choose the allowed age according to deployment policy, incident posture, change cadence, and governance requirements. The implementation only enforces that the chosen window is explicit and bounded.

## Security / privacy boundary

This block does not weaken KMD-272 through KMD-275. Reverification still validates receipt authenticity, candidate commit/version/signing-key identity, signed manifest integrity, digest integrity, retained paths, scope, and exact bundle bytes.

No secret, external evidence content, user data, media data, or provider response is persisted by this change.

## Tests

Regression coverage includes:

- an authenticated receipt inside the configured freshness window;
- exact-boundary acceptance;
- rejection immediately beyond the boundary;
- rejection of zero, decimal, non-canonical and out-of-range windows;
- preservation of existing retained manifest/digest substitution and tamper checks.

The complete repository CI remains required before merge.

## Migration

No Prisma or user-data migration is required.

Operational adoption: update any invocation of `pnpm release:evidence:bundle:receipt:reverify` to provide an explicit `--max-age-hours` policy value.

## Rollback

Revert KMD-276. KMD-275 reverification remains available without a receipt-age requirement, while all KMD-272/KMD-274 authenticity and retained-bundle integrity checks remain intact.

## Proof boundary

Passing KMD-276 proves only that the authenticated receipt is recent enough under the explicitly selected policy and still matches the retained signed bundle. It does not prove the truthfulness or current validity of the underlying external evidence, production deployment, DNS/TLS, restore drills, monitoring/on-call, legal/privacy review, export/deletion, moderation/support operations, antimalware validation, physical mobile testing, or store publication.
