# KMD-366 — Deleted-session revocation proof

## Status

Active. Do not mark merged until exact-head canonical CI succeeds and review/thread gates are clear.

## Problem

KnowMe already validates that account deletion removes the account and that password login is rejected afterwards. The production data-lifecycle smoke, however, did not explicitly prove that an access token issued before deletion loses authorization after the destructive operation.

That distinction matters for launch readiness: a deleted account must not retain an already-issued bearer capability until the JWT expires naturally. The API JWT strategy already resolves both the current user and the current `AuthSession` on every authenticated request and fails closed when either is gone, suspended, revoked or expired. KMD-366 adds a production-safe canary proof for that behavior instead of changing authentication semantics.

## Delivered

- Add `scripts/deleted-session-revocation-smoke.mjs`.
- The smoke requires an exact destructive-canary confirmation and a canonical HTTPS production origin.
- It creates a fresh ephemeral account and requires its issued access token to authorize `/account/export` before deletion.
- It deletes only that canary through the real authenticated `DELETE /account` route.
- It reuses the exact already-issued bearer token after deletion and requires `/account/export` to return HTTP 401.
- It separately requires password login for the deleted canary to return HTTP 401.
- It never writes the bearer token, canary email, username or password into its result object.
- It attempts best-effort cleanup only when a failure occurs before deletion; the original failure remains authoritative.
- Add focused tests for canonical-origin validation, request ordering, bearer-token reuse across deletion, fail-closed behavior when the old token still authorizes, destructive confirmation, secret non-disclosure and cleanup.
- Wire the focused test into the root `pnpm test` gate and expose `pnpm release:deleted-session:smoke` for a real production canary execution.

## Migration

None. No Prisma schema, persisted user data, public API contract or authentication token format changes are introduced.

## Rollback

Revert KMD-366. Runtime authentication behavior remains unchanged; only the additional release proof and its tests are removed.

## Required validation before merge

- exact-head repository CI;
- root unit/release script tests including `deleted-session-revocation-smoke.test.mjs`;
- normal build, Prisma migration/drift gates, API/Web runtime boot and E2E gates already enforced by canonical CI;
- no unresolved review thread or blocking review.

## Real-world proof boundary

A green repository CI proves only the smoke implementation and its deterministic tests. It does not prove that the command has been executed against the real production origin. A market-release claim for deleted-session revocation requires a dated successful `pnpm release:deleted-session:smoke` execution against the canonical production deployment.

Even a successful production canary proves only that the tested bearer token and password login lose authorization after deletion for that canary. It does not establish legal/privacy compliance, provider-backup erasure, every external identity-provider behavior, physical-device behavior, store publication, or production branch governance.
