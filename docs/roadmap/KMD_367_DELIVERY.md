# KMD-367 — Revocation-aware data lifecycle market evidence

## Status

Active. Do not mark merged until exact-head canonical CI succeeds and review/thread gates are clear.

## Problem

KMD-366 added a dedicated production-safe canary proving that a bearer token issued before account deletion loses authorization after `DELETE /account`. KnowMe's older market-release evidence path for `data_export_delete_validation`, however, was still based on the KMD-291 schema: register, export, delete, then rejected password login. That meant a release operator could theoretically satisfy the market evidence slot with a retained lifecycle artifact that did not contain the newer deleted-session revocation guarantee.

KMD-367 closes that proof gap without introducing a second competing release-evidence item. The canonical data lifecycle smoke itself now proves bearer revocation and the existing evidence binder requires the upgraded schema.

## Delivered

- Upgrade `scripts/data-export-delete-smoke.mjs` evidence output from schema version 1 to schema version 2.
- After successful canary deletion, reuse the exact access token issued at registration against `GET /account/export` and require HTTP 401.
- Keep the independent rejected-password-login check after bearer revocation.
- Add `preDeletionBearerAuthorizationRevoked: true` to the retained artifact contract.
- Keep bearer tokens, email, username and password out of the retained result.
- Upgrade `scripts/data-export-delete-smoke-evidence-binding.mjs` to accept only schema-v2 lifecycle artifacts and require the revocation check before creating `data_export_delete_validation` market evidence.
- Explicitly reject legacy schema-v1 artifacts so a release manifest cannot satisfy the lifecycle evidence slot with proof that predates the KMD-366 revocation guarantee.
- Extend deterministic tests for request ordering, exact bearer-token reuse, fail-closed behavior if the old bearer remains authorized, schema-v1 rejection and evidence binding.

## Migration

None. No Prisma schema, database migration, public API contract or authentication token format changes are introduced. This is a release-proof schema upgrade only. Existing retained schema-v1 lifecycle artifacts remain historical evidence but are no longer sufficient for new market-release binding.

## Rollback

Revert KMD-367 to restore the schema-v1 lifecycle artifact and binder. This rollback would intentionally remove the requirement that `data_export_delete_validation` include pre-deletion bearer revocation proof, so it must not be used for a release that claims KMD-366's deletion-session guarantee.

## Required validation before merge

- exact-head canonical repository CI;
- root test suite including `data-export-delete-smoke.test.mjs` and `data-export-delete-smoke-evidence-binding.test.mjs`;
- existing build, Prisma migration/drift, production-image boot, Web E2E and API E2E gates enforced by canonical CI;
- no unresolved review thread or blocking review.

## Real-world proof boundary

Repository CI proves only the deterministic smoke and binder behavior. It does not prove the flow against the real production origin. Before market release, an operator must run the upgraded `pnpm release:data-lifecycle:smoke` against the canonical HTTPS production deployment with the explicit destructive-canary confirmation, retain the schema-v2 artifact, bind it into `data_export_delete_validation`, sign and retain the release evidence bundle, and pass `check:market-ready`.

This proof still does not establish legal/privacy compliance, provider-backup erasure, external identity-provider behavior, physical-device behavior, production branch governance, production backup/restore, monitoring delivery, deployment correctness, object-storage durability or store publication.
