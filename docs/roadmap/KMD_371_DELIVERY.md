# KMD-371 — Object-storage market evidence binding

## Goal

Make the real object-storage provider validation introduced by KMD-369 and semantically hardened by KMD-370 an actual market-release gate instead of an optional retained artifact.

## Changes

- Add `object_storage_provider_validation` to the evidence required by both `WEB_V1` and `FULL` release scopes.
- Add a dedicated semantic binder that accepts only a valid KMD-369 schema-v1 object-storage smoke artifact after KMD-370 validation.
- Emit a normal VERIFIED market-evidence item bound to the exact retained artifact digest, verifier, retained evidence URI and validity window.
- Add an action-plan mapping that directs operators to the real storage smoke followed by the dedicated evidence binder.
- Expose `pnpm release:object-storage:smoke:evidence:bind` and include binder regressions in the root test suite.

## Safety and proof boundary

A repository test or CI run does not prove a production bucket. The required evidence can become VERIFIED only from retained bytes produced by a real provider smoke and accepted by the semantic binder. The smoke itself still proves only signed PUT/GET/DELETE, anonymous-read denial, byte identity and post-delete absence; IAM least privilege, provider encryption, versioning, lifecycle, replication, durability, account-level purge execution and provider compliance require separate operational evidence where applicable.

The binder reads retained evidence through the repository's safe retained-file path in CLI mode and never accepts arbitrary hash-only JSON as proof.

## Tests

Regressions cover:

- valid provider smoke -> VERIFIED `object_storage_provider_validation` item;
- anonymous-read privacy regression -> rejection;
- malformed JSON -> rejection;
- materially future observation -> rejection;
- market readiness now requiring the object-storage evidence identifier through the canonical required-evidence registry.

## Migration

No Prisma migration and no user-data migration.

## Rollback

Revert KMD-371. This removes the new market evidence requirement and binder only. It does not alter runtime media storage, existing objects, database state, KMD-369 provider-smoke behavior or KMD-370 semantic validation.

## External blockers unchanged

KMD-371 does not claim or satisfy branch protection, legal review, physical-device QA, production backup/restore, production monitoring, production deployment/orchestrator validation, real production bucket execution, App Store submission or Google Play submission.
