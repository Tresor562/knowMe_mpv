# KMD-360 — Frozen runtime container dependency installation

## Goal

Extend KMD-359's canonical PNPM lockfile guarantee to the API and Web runtime container build paths.

## Changes

- `Dockerfile.api` and `Dockerfile.web` copy the canonical `pnpm-lock.yaml` before dependency installation.
- Workspace contract packages are copied before filtered installation so `workspace:*` dependencies can be resolved without weakening frozen-lockfile semantics.
- Both runtime Dockerfiles now use `pnpm install ... --frozen-lockfile` and reject `--frozen-lockfile=false`.
- Canonical CI builds both runtime images on the exact PR head.
- `scripts/runtime-container-lockfile-preflight.test.mjs` prevents regression to a non-frozen runtime install.

## Migration

No database migration is required. This is a build/reproducibility change only.

## Validation required before merge

- supply-chain and lockfile preflights pass;
- canonical `pnpm install --frozen-lockfile` passes;
- unsuppressed production dependency audit passes at high/critical threshold;
- Prisma generation, migration deploy and schema drift check pass;
- monorepo build and complete tests pass;
- API runtime Docker image builds successfully from the repository root;
- Web runtime Docker image builds successfully from the repository root;
- Web E2E and API E2E pass;
- no blocking review or unresolved review thread remains.

## Rollback

Revert the KMD-360 merge commit. Do not remove the canonical lockfile introduced by KMD-359. If a container build regression requires emergency mitigation, restore the prior Dockerfile only on a dedicated reviewed branch and document why frozen installation could not be maintained.

## Proof boundaries

A successful CI container build proves that the Docker build recipe can resolve and build against the committed lockfile in GitHub's CI environment. It does not prove a production deployment, production runtime health, physical-device validation, legal/privacy review, backup restoration, monitoring delivery, or store publication.
