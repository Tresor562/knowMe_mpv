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
- KMD-372's fail-closed provider purge is preserved: provider failure still prevents destructive media metadata removal.

## Tests

`apps/api/src/media/media.service.account-cleanup.spec.ts` covers:

1. deletion fence establishment before provider cleanup;
2. provider failure still prevents metadata removal;
3. successful provider purge removes metadata only afterward;
4. upload completion is rejected when deletion owns the lifecycle fence;
5. the user-row lock is acquired before provider write and provider write precedes durable metadata creation.

The canonical repository CI remains authoritative for build, unit, migration/drift, runtime image/boot and E2E validation.

## Migration

No Prisma schema migration is introduced. The fence uses the existing `MediaUploadSession` persistence contract plus the existing PostgreSQL `User` row as the serialization authority.

## Rollback

Revert the KMD-373 service and test changes. That restores the KMD-372 behavior, including its known upload-vs-deletion race window; therefore rollback should be used only if a release-blocking regression is found and should itself block market release until an equivalent race-safe mechanism is restored.

## Evidence boundary

This delivery proves code-level and CI-level serialization behavior. It does not claim that a production object-storage provider has been exercised during a real account deletion, that provider-retained object versions are purged, or that physical/store/legal release gates are complete.
