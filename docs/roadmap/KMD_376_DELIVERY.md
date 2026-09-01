# KMD-376 — Media grant deletion fence

Date: 2026-09-01

## Goal

Close the remaining database race between single-media deletion and concurrent creation of access/download authority.

KMD-375 made provider deletion fail closed, but the later database tombstone still runs after provider deletion. Without a database lifecycle fence, an access grant or download-token row could be inserted around the grant cleanup/tombstone transition and survive as stale authority metadata for a deleted asset.

## Implementation

KMD-376 makes the `MediaAsset` row the serialization point for media authority:

- `MediaAccessGrant` inserts and `assetId` updates must lock and resolve an active (`deletedAt IS NULL`) `MediaAsset`;
- `MediaDownloadGrant` inserts and `assetId` updates must satisfy the same invariant;
- transitioning `MediaAsset.deletedAt` from null to a tombstone timestamp purges both access and download grants inside the same database transaction;
- the migration removes historical authority rows whose asset is already missing/tombstoned before installing the guards.

The locking order closes both interleavings. If grant creation owns the asset row first, it commits before deletion and the tombstone trigger subsequently removes it. If deletion owns/tombstones the asset first, grant creation waits and then fails because the asset is no longer active.

The existing KMD-375 provider-first ordering is preserved. Provider failure therefore still leaves durable metadata and grants untouched for retry; only after provider deletion succeeds can the database tombstone boundary run.

## Tests

`apps/api/test/media-grant-deletion-fence.e2e-spec.ts` proves against migrated PostgreSQL that:

1. tombstoning an asset removes existing access and download authority in the same transition;
2. access authority cannot be inserted for a tombstoned asset;
3. download authority cannot be inserted for a tombstoned asset;
4. rejected authority leaves no stale grant/token row;
5. when grant creation owns the asset row first, concurrent tombstoning blocks until that transaction commits and then removes the grant;
6. when deletion owns the asset row first, concurrent grant creation blocks until the tombstone commits and is then rejected.

Canonical CI remains authoritative for migration deploy/drift, complete build/unit validation, runtime images/boots, Web E2E and PostgreSQL-backed API E2E.

## Migration

Adds `20260901195500_kmd_376_media_grant_deletion_fence`.

The migration performs irreversible cleanup of already-invalid authority rows, then installs:

- `knowme_guard_active_media_asset_grant()`;
- `knowme_guard_media_access_grant_asset`;
- `knowme_guard_media_download_grant_asset`;
- `knowme_purge_media_grants_on_tombstone()`;
- `knowme_purge_media_grants_on_tombstone` trigger.

No Prisma datamodel field is added; these are lifecycle invariants not represented by Prisma relations alone (notably `MediaDownloadGrant` has no asset relation/FK in the current datamodel).

The migration is required to deploy successfully against a clean PostgreSQL database in canonical CI. SQL identifiers used as aliases deliberately avoid reserved keywords so the migration remains valid on the repository's pinned PostgreSQL release.

## Rollback

After deployment, rollback must use a forward migration to drop the KMD-376 triggers/functions. Do not recreate historical stale authority rows deleted by this migration.

Removing this fence reopens the grant-vs-deletion race and must block market release until an equivalent invariant is restored.

## Evidence boundary

This delivery proves database lifecycle behavior in repository CI. It does not prove production object-provider deletion/version purge, legal erasure compliance, physical-device validation, production backup/restore, monitoring, deployment/orchestrator wiring, branch protection or store publication.
