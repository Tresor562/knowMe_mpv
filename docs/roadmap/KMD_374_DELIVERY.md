# KMD-374 — Media audit / commit consistency

Date: 2026-09-01

## Goal

Prevent a successful media metadata commit from being left without its provider object when post-commit audit persistence fails.

Before KMD-374, `MediaService.completeUpload()` committed the upload-session consumption and `MediaAsset` metadata in a Prisma transaction, then wrote `MEDIA_UPLOAD_COMPLETE` through `AuditService` outside that transaction. The surrounding catch still deleted the object-storage key on any later error. If the audit insert failed after the Prisma commit, KnowMe could therefore retain an active `MediaAsset` row whose private provider object had just been deleted.

## Implementation

- `AuditService.record()` accepts an optional Prisma transaction client while preserving the existing default behavior for all callers.
- `MEDIA_UPLOAD_COMPLETE` audit persistence now runs inside the same interactive Prisma transaction as upload-session consumption and `MediaAsset` creation.
- The provider object is still written before database commit so a database/audit failure can be compensated by deleting the just-written object.
- If the audit insert fails, Prisma rolls back session consumption plus media metadata, then the existing compensating provider delete removes the object.
- Once the transaction commits, no post-commit audit call remains that can enter the provider-delete catch path.
- KMD-373's account-deletion serialization and KMD-372's fail-closed account cleanup are preserved.

## Tests

`apps/api/src/media/media.service.account-cleanup.spec.ts` now additionally proves that:

1. the provider write precedes durable media metadata creation;
2. media metadata creation precedes the upload audit record;
3. the audit record receives the active Prisma transaction client;
4. a transactional audit failure rejects the upload and invokes compensating provider deletion;
5. a successful transaction does not invoke compensating provider deletion.

Canonical CI remains authoritative for TypeScript build, unit tests, migration/drift validation, runtime images/boots and API/Web E2E.

## Migration

No Prisma/database migration is introduced by KMD-374.

## Rollback

Revert the KMD-374 `AuditService`, `MediaService` and test changes. Doing so restores the known post-commit audit/provider consistency defect, so such a rollback must block market release until an equivalent atomic audit strategy is restored.

## Evidence boundary

This delivery proves repository-level transactional behavior and CI coverage. It does not prove a real production object-storage outage/audit-database failure drill, production provider durability, legal review, physical-device validation, or store publication.
