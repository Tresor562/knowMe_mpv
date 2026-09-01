# KMD-374 — Upload-session creation deletion fence

Date: 2026-09-01

## Goal

Close the remaining account-media lifecycle race left after KMD-373: a new `MediaUploadSession` could be created after the application-level deletion-fence lookup but before the session insert completed.

`MediaUploadSession.ownerId` intentionally has no Prisma relation/FK. KMD-373 therefore protected upload completion and removed retained sessions when `User` is deleted, but a session insertion racing the final account deletion could otherwise occur outside that cleanup trigger's snapshot and become an orphaned authority record.

## Implementation

KMD-374 adds a PostgreSQL `BEFORE INSERT` trigger on `MediaUploadSession`.

For every session insertion the trigger:

1. acquires `FOR UPDATE` on the owning `User` row, the same lifecycle lock used by account-media cleanup and upload completion;
2. rejects insertion if the owner no longer exists;
3. allows the internal account-deletion marker itself while the owner exists;
4. rejects every normal session insertion when the durable account-deletion marker already exists.

This makes the database invariant authoritative for every insert path. If normal session creation wins the user-row lock, it commits before deletion can install the marker and account cleanup subsequently removes the session. If deletion wins, later normal session creation waits and then observes either the marker or the deleted owner and fails without creating an orphan.

The existing application-level marker check remains useful for the ordinary already-fenced path and preserves the explicit conflict response before reaching the database guard. The database trigger is defense in depth for the narrow race between that check and insertion.

## Tests

`apps/api/test/media-account-deletion-fence.e2e-spec.ts` now covers the KMD-373 cleanup invariant plus two KMD-374 database invariants against migrated PostgreSQL:

1. a normal upload session cannot be inserted after the deletion marker exists;
2. a normal upload session cannot be inserted for an owner that has already been deleted;
3. both rejection paths leave zero non-marker orphan sessions for the tested owner.

Canonical CI remains authoritative for migration deploy/drift, build, unit, runtime image/boot and API/Web E2E validation.

## Migration

Adds `20260901192000_kmd_374_media_upload_session_owner_guard`.

The migration creates:

- function `knowme_guard_media_upload_session_owner`;
- trigger `knowme_guard_media_upload_session_owner` on `MediaUploadSession`.

No Prisma datamodel field is added.

## Rollback

If KMD-374 must be rolled back after deployment, use a forward migration that drops the trigger and function. Do not modify or recreate user/session data merely to roll back this guard.

Removing the guard reopens the upload-session-creation/account-deletion race, so a release must remain blocked until an equivalent lifecycle invariant exists.

## Evidence boundary

This delivery proves the database-level ownership/fence invariant in repository CI. It does not prove a production account deletion, production object-provider purge/version deletion, physical-device behavior, legal review, monitoring, production backup/restore, branch governance or store publication.
