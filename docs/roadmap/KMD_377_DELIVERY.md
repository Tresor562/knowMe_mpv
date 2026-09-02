# KMD-377 — Media access revocation / download-token fence

Date: 2026-09-01

## Goal

Close the remaining authorization race between revoking a grantee's `MediaAccessGrant` and issuing a `MediaDownloadGrant` for the same active private asset.

KMD-376 serializes grant creation with `MediaAsset` tombstoning. It does not by itself make an access-grant revocation the serialization boundary for download-token creation. Without an additional database invariant, an application request that observed access immediately before revocation could attempt to persist a new download token after the revocation committed.

## Implementation

Migration `20260901221000_kmd_377_media_revocation_download_fence`:

- removes historical non-owner download grants that no longer have active access authority;
- keeps owner download grants valid while the underlying asset remains active;
- adds a PostgreSQL `BEFORE INSERT/UPDATE` guard for `MediaDownloadGrant`;
- locks the active `MediaAsset` and, for non-owners, the exact active `MediaAccessGrant` row before download authority is persisted;
- rejects non-owner download authority when the access grant is missing, revoked or expired;
- purges all outstanding download tokens for `(assetId, granteeId)` when `revokedAt` changes from `NULL` to a timestamp;
- also purges outstanding download tokens if an access-grant row is deleted.

The lock ordering is deliberately `MediaAsset` then `MediaAccessGrant`, matching the existing media authority path and avoiding a second independent authorization source.

## Security invariant

After an access revocation commits, no durable non-owner `MediaDownloadGrant` may remain or be newly persisted for that revoked `(assetId, granteeId)` authority.

Two serialization outcomes are safe:

1. token issuance acquires the access row first: revocation waits, then purges the token before its own commit;
2. revocation acquires/updates the access row first: later token insertion observes no active access and fails closed.

Existing content reads still re-check current media authorization, so this migration strengthens the durable-token boundary rather than replacing application authorization.

## Tests

`apps/api/test/media-security.e2e-spec.ts` now proves with PostgreSQL-backed E2E coverage that:

- a guest can obtain a token only while explicitly granted access;
- revocation removes already-issued guest download tokens;
- a token issued before revocation is rejected afterwards;
- normal API issuance is rejected after revocation;
- a direct stale token insertion after revocation is rejected by PostgreSQL even though the asset is still active;
- after access is granted again, a durably created pre-revocation token is purged when access is revoked again;
- owner download authority remains covered by the active-asset rule.

Canonical CI and Runtime readiness must pass on the exact PR head before merge.

## Migration / data impact

This is a forward-only security migration.

The cleanup DELETE is intentionally irreversible for stale unauthorized download tokens. Those tokens are short-lived authorization artifacts and must not be restored by rollback.

No user media object and no `MediaAsset` row is deleted by this migration.

## Rollback

If application compatibility requires reverting the new runtime invariant, remove the KMD-377 triggers/functions in a dedicated rollback migration. Do **not** recreate download grants removed by the cleanup or by a committed revocation.

The KMD-376 asset-tombstone guards and purge trigger must remain in place.

## Proof boundary

This delivery proves repository behavior against the CI PostgreSQL environment only after exact-head validation succeeds. It does not prove:

- production database migration execution;
- production object-storage behavior;
- production account-deletion/provider-version deletion;
- legal/privacy review;
- physical Web/iOS/Android validation;
- production deployment, monitoring, alerting or backup/restore;
- branch-protection compliance;
- App Store or Google Play submission/publication.
