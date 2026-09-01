# KMD-372 — Account media deletion fail-closed

## Goal

Prevent KnowMe from reporting account deletion as successful when private media objects could not actually be deleted from the configured storage provider.

## Problem found from the live post-KMD-371 baseline

`AccountService.deleteAccount()` invokes `MediaService.cleanupAccount()` before the final account transaction. The previous cleanup implementation deleted media grants, media rows and upload sessions from PostgreSQL first, then attempted object-storage deletion with `catch(() => undefined)` for every object.

That ordering could permanently discard the only application metadata identifying a private object while silently leaving the object in S3-compatible storage. The outer account deletion could then continue and succeed even though user-owned private bytes still existed at the provider. That is not an acceptable deletion/privacy boundary for a market release.

## Changes

- `MediaService.cleanupAccount()` now enumerates the account's media objects and requires each provider deletion to succeed before deleting media metadata.
- Provider deletion errors are no longer swallowed during destructive account cleanup.
- Database media/grant/session cleanup starts only after all known private objects have been acknowledged deleted by `MediaStorageService`.
- The existing storage delete contract is retry-safe: local deletion uses `rm(..., { force: true })`, while the S3-compatible DELETE path accepts `404`, so a retry after a later database failure remains safe.
- Add focused regressions proving that a provider failure prevents the media database transaction and that the metadata cleanup runs only after all provider deletions succeed.

## Failure semantics

KMD-372 deliberately fails closed for privacy. If private storage is unavailable, `DELETE /account` must fail instead of falsely reporting completed deletion while known private objects remain.

A partial provider purge is still possible if one object deletion succeeds and a later object deletion fails. In that case PostgreSQL metadata is retained, so KnowMe still has the storage keys needed for a retry. Already deleted objects are safe to delete again because the storage delete contract is idempotent.

If all provider deletions succeed but a later database operation fails, a retry can also safely repeat provider deletion before retrying metadata/account cleanup. The user-requested destructive action may therefore have partially removed media even though the account request returned an error; this is preferable to falsely certifying complete deletion while retaining provider data and is explicitly covered by the rollback/proof boundary below.

## Tests

`apps/api/src/media/media.service.account-cleanup.spec.ts` covers:

- provider deletion failure rejects cleanup;
- no media/grant/session metadata deletion begins after a provider failure;
- successful provider deletion of every known object precedes the database media cleanup transaction.

The canonical repository CI remains authoritative for the complete build, unit, migration, runtime-container and E2E validation.

## Migration

No Prisma migration and no user-data migration.

## Rollback

Revert KMD-372 to restore the previous cleanup ordering. This rollback is operationally safe for schema compatibility because no database shape changes, but it reintroduces the privacy risk of silently orphaned provider objects and therefore must not be used for a market release without an equivalent deletion guarantee.

## Proof boundary

Repository tests prove control flow only. They do not prove that a production provider actually deleted historical or future user objects, that provider versioning/lifecycle leaves no retained versions, or that account deletion has been physically exercised against the production bucket. Those remain real deployment/privacy evidence and must not be claimed without direct proof.
