# KMD-353 — Pin docker-compose PostgreSQL image digest

Date: 2026-08-30

## Goal

Remove the remaining mutable PostgreSQL container reference from the repository's canonical local/recovery compose environment so development and operator reproduction does not silently pull a different PostgreSQL 16 Alpine image over time.

## Changes

- `docker-compose.yml` now uses `postgres:16.15-alpine@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685`.
- `scripts/ci-workflow-supply-chain-preflight.test.mjs` now verifies the compose PostgreSQL service is digest-pinned and rejects a regression to `postgres:16-alpine`.
- The digest matches the PostgreSQL 16.15 Alpine index already audited and used for the canonical CI service.

## Validation required before merge

1. Canonical GitHub Actions must complete successfully on the exact PR head.
2. The supply-chain preflight must pass and prove both CI and compose PostgreSQL references remain immutable.
3. Existing build, migrations, root tests, Web E2E and API E2E gates must remain green.
4. Reviews and review threads must not contain unresolved blockers.

## Migration

No Prisma, database schema, user-data or API migration is introduced. Existing Docker volumes are not rewritten by this change.

## Rollback

Revert this delivery commit to restore the prior compose image reference. If an operator must intentionally upgrade PostgreSQL, update the explicit version and digest together, verify the upstream image identity, run the full CI suite, and document the change in a new delivery rather than replacing the digest silently.

## Proof boundary

This delivery proves repository configuration immutability for the compose PostgreSQL image only. It does not prove a production restore, a production deployment, real monitoring delivery, legal/privacy approval, supported-device physical validation, or App Store / Google Play publication.

The missing committed `pnpm-lock.yaml` remains a separate dependency reproducibility gap and is not claimed solved here.
