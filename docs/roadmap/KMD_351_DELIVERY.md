# KMD-351 — Pin the CI PostgreSQL service image by digest

## Problem

The canonical `quality` workflow still used the mutable service image reference `postgres:16-alpine`. That tag can move to different bytes without any repository change, weakening reproducibility and allowing CI database behavior to change outside KnowMe review history.

## Delivery

- Replace the mutable tag with `postgres:16.15-alpine@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685`.
- Keep the human-readable version tag while binding execution to the immutable multi-platform index digest verified from Docker Hub on 2026-08-30.
- Extend the existing CI supply-chain preflight so a mutable `postgres:16-alpine` reference cannot be silently reintroduced.

## Tests

`scripts/ci-workflow-supply-chain-preflight.test.mjs` now requires the PostgreSQL service image to contain an exact SHA-256 digest and rejects the previous mutable tag form. The full canonical `quality` workflow remains the acceptance gate because it actually starts the pinned service and runs migrations, build, unit tests and E2E suites against it.

## Migration

No Prisma, API, user-data or release-evidence migration is required.

## Rollback

Revert the KMD-351 commits. No data rollback is required. Reverting to an unpinned tag intentionally weakens reproducibility and should only be temporary while selecting a replacement verified digest.

## Operational maintenance

Image upgrades are now deliberate. When PostgreSQL is upgraded, verify the intended official Docker Hub tag/index digest, update both the workflow and the regression expectation if the version changes, then require the complete exact-head CI to pass before merge.

## Separate unresolved dependency reproducibility boundary

The repository currently has no committed `pnpm-lock.yaml`, while CI installs with `pnpm install --frozen-lockfile=false`. KMD-351 does not conceal or claim to solve that separate dependency-reproducibility gap. Introducing and validating a canonical lockfile must be handled independently so CI is not broken by enabling frozen mode without a lockfile.

## Proof boundary

KMD-351 proves only that the repository-controlled CI PostgreSQL service resolves through an immutable image digest. It does not attest Docker Hub or the image contents, production PostgreSQL, production restore execution, legal/privacy review, physical devices, deployment, monitoring or store publication.
