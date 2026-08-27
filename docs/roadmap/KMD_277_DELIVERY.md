# KMD-277 — Release receipt freshness policy binding

## Goal

Make the freshness window used by authenticated release-receipt reverification an explicit release policy rather than an ad-hoc operator choice.

## Delivered behavior

- `KNOWME_RELEASE_RECEIPT_MAX_AGE_HOURS` is required by the market-readiness preflight.
- The value must be a canonical integer between 1 and 8760 hours.
- Direct library callers of receipt-to-bundle reverification must provide a valid freshness window; omission fails closed.
- The reverification CLI reads the configured policy from `KNOWME_RELEASE_RECEIPT_MAX_AGE_HOURS`.
- `--max-age-hours` is optional compatibility input, but when supplied it must exactly match the configured release policy.
- Existing receipt HMAC, candidate commit/version, signing-key identity, bundle digest, path, exact-byte and scope checks remain unchanged.

## Why this block exists

KMD-276 bounded receipt age, but the reusable function still accepted an omitted freshness value and the CLI let an operator select any allowed value per invocation. That made a stale receipt potentially acceptable by choosing a more permissive window at verification time. KMD-277 makes the policy explicit and fail-closed.

## Validation

- Unit coverage requires a freshness value for direct callers.
- Unit coverage checks the inclusive boundary and stale-receipt rejection.
- Unit coverage rejects non-canonical/out-of-range values.
- Unit coverage verifies that a CLI override cannot differ from the configured policy.
- Release-preflight coverage rejects missing, malformed and out-of-range policy values and accepts exact bounds.
- The new preflight is part of `pnpm check:market-ready` and its tests are part of root `pnpm test`.

## Migration

No Prisma or user-data migration is required.

Release operators must set `KNOWME_RELEASE_RECEIPT_MAX_AGE_HOURS` before running `check:market-ready` or receipt reverification. The chosen value must come from the approved release/governance policy; KnowMe does not invent a universal legal or operational duration.

Existing automation that passes `--max-age-hours` may keep doing so only when the value exactly equals the configured environment policy.

## Rollback

Revert KMD-277. KMD-276 remains available and still supports bounded receipt freshness, but the window again becomes invocation-specific and direct library callers can omit it.

## Proof boundary

Passing this policy gate proves only that the retained authenticated receipt is reverified under an explicitly configured maximum-age policy. It does not prove the truth of external evidence, deployment status, DNS/TLS, restore drills, monitoring/on-call, legal/privacy review, export/deletion operations, moderation/support procedures, antimalware production validation, physical mobile tests, or store publication.
