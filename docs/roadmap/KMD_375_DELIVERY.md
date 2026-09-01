# KMD-375 — Provider-first single-media deletion

Date: 2026-09-01

## Goal

Make an explicit single-media deletion fail closed at the same privacy boundary already enforced for whole-account media cleanup.

Before KMD-375, `MediaService.deleteAsset()` revoked grants and marked the durable `MediaAsset` row deleted before asking the private storage provider to remove the underlying object. If the provider deletion failed, KnowMe could return an error only after the application had hidden the media and discarded the user's normal retry path while private bytes still existed in storage.

## Implementation

`deleteAsset()` now:

1. resolves the active asset and its durable storage key;
2. requires the private storage provider deletion to succeed first;
3. only then revokes download/access grants and tombstones the durable `MediaAsset` row inside the existing database transaction;
4. records the deletion audit event only after both boundaries succeed.

The provider drivers are intentionally idempotent, so if provider deletion succeeds but database finalization fails, a later retry can safely ask the provider to delete the already-absent object again while the still-active durable row retains the key needed to retry.

This matches KMD-372's fail-closed account-deletion principle: KnowMe does not discard the application metadata needed to locate private provider bytes before provider deletion is confirmed.

## Tests

`apps/api/src/media/media.service.delete-asset.spec.ts` proves:

1. provider failure leaves grants and `MediaAsset` metadata untouched and emits no success audit;
2. provider deletion occurs before grant revocation and metadata tombstoning;
3. database finalization failure after provider deletion is surfaced and is not falsely audited as success.

Canonical CI remains authoritative for complete build, unit tests, migration/drift checks, runtime images/boots, Web E2E and PostgreSQL-backed API E2E.

## Migration

None. KMD-375 changes application deletion ordering only.

## Rollback

Application rollback reverts `MediaService.deleteAsset()` to the previous ordering and removes the KMD-375 unit test/documentation. Such a rollback reopens the known provider-orphan risk and must block market release until an equivalent fail-closed deletion mechanism is restored.

## Evidence boundary

A green repository CI proves ordering and failure behavior against mocked storage responses. It does not prove deletion against the production object-storage provider, provider-retained versions/lifecycle semantics, legal erasure compliance, physical-device validation, production backup/restore, monitoring, deployment, branch governance or store publication.
