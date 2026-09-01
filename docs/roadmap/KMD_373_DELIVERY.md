# KMD-373 — Account media lifecycle race fence

Date: 2026-09-01

## Goal

Close the remaining privacy race between account deletion and a media upload that was already in flight when deletion began.

KMD-372 made provider deletion fail closed, but its provider purge still took a snapshot of known media assets before the final account transaction. Without additional coordination, an upload could theoretically write a new private object after that snapshot and before the account row was removed.

## Implementation

- Account-media cleanup installs a durable deletion fence before reading provider objects.
- Fence installation and upload completion both serialize on the owning `User` row with PostgreSQL `FOR UPDATE`.
- Upload completion re-checks the deletion fence only after it owns that row lock and before object-storage `put`.
- If deletion wins the lock, later upload completion fails before provider write or asset metadata creation.
- If upload completion wins the lock, object write and durable `MediaAsset` creation finish while the row is held; deletion can only install its fence afterward, so the cleanup snapshot includes that asset.
- The deletion fence is retained while provider purge and database media cleanup run, preventing a new completion from appearing in the gap before the outer account deletion transaction.
- A database trigger removes every remaining `MediaUploadSession` for the account inside the same PostgreSQL transaction that deletes the `User` row. The KMD-373 fence therefore cannot remain as an orphan after successful account deletion.
- The migration removes any historical upload-session rows whose owner no longer exists before installing that trigger. Upload sessions are ephemeral authority records and cannot be valid after their owner has already been deleted.
- KMD-372's fail-closed provider purge is preserved: provider failure still prevents destructive media metadata removal.

## Tests

`apps/api/src/media/media.service.account-cleanup.spec.ts` covers:

1. deletion fence establishment before provider cleanup;
2. provider failure still prevents metadata removal;
3. successful provider purge removes metadata only afterward;
4. upload completion is rejected when deletion owns the lifecycle fence;
5. the user-row lock is acquired before provider write and provider write precedes durable metadata creation.

`apps/api/test/media-account-deletion-fence.e2e-spec.ts` proves against migrated PostgreSQL that deleting the owning `User` removes the retained KMD-373 fence and leaves no `MediaUploadSession` for that deleted account.

The canonical repository CI remains authoritative for build, unit, migration/drift, runtime image/boot and E2E validation.

## Migration

KMD-373 adds `20260901190500_kmd_373_media_deletion_fence_cleanup`.

The migration:

1. deletes historical `MediaUploadSession` rows whose `ownerId` no longer resolves to an existing `User`;
2. installs the `knowme_cleanup_media_upload_sessions_on_user_delete` PostgreSQL trigger/function;
3. deletes an account's remaining upload sessions immediately before its `User` row is deleted, within the same database transaction.

No Prisma datamodel field is added. The trigger implements a database lifecycle invariant that Prisma does not model directly; canonical CI's migration deploy and datamodel-drift checks must still pass before merge.

The historical orphan cleanup is intentionally irreversible: deleted stale upload-session authority must not be reconstructed during rollback.

## Rollback

Application rollback must revert the KMD-373 service behavior and remove the database trigger/function with a forward migration if KMD-373 has already been deployed. Do not attempt to recreate orphan upload-session rows removed by the migration.

Rolling back to KMD-372 restores the known upload-vs-deletion race window; therefore such a rollback must itself block market release until an equivalent race-safe mechanism is restored.

## Evidence boundary

This delivery proves code-level and CI-level serialization and database cleanup behavior. It does not claim that a production object-storage provider has been exercised during a real account deletion, that provider-retained object versions are purged, or that physical/store/legal release gates are complete.
