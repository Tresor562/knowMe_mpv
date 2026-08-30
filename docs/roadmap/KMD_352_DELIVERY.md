# KMD-352 — Pin runtime Node container images

## Goal

Remove the remaining mutable `node:22-alpine` base-image dependency from the API and Web production Dockerfiles.

## Changes

- Pin both `Dockerfile.api` and `Dockerfile.web` to the official Node `22.23.2-alpine` multi-platform index digest `sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32`.
- Extend `scripts/ci-workflow-supply-chain-preflight.test.mjs` so both runtime Dockerfiles must retain an immutable Node digest and cannot regress to `FROM node:22-alpine`.

## Validation

Required before merge:

- canonical GitHub Actions CI green on the exact PR head;
- root test suite executes the extended supply-chain preflight;
- API and Web builds remain green through canonical CI;
- no unresolved blocking review threads.

## Migration

No database, schema, user-data or API migration is required.

## Rollback

Revert the KMD-352 merge commit. If the pinned image becomes unavailable or is revoked, replace it only with a newly verified official Node image digest and update this document/tests in the same reviewed change.

## Proof boundary

This delivery proves repository configuration and automated build compatibility only. It does not prove a production deployment, physical-device validation, legal/privacy review, backup restore, monitoring delivery, or store publication.

## Follow-up boundary

The repository still lacks a committed `pnpm-lock.yaml`; dependency installation therefore remains non-frozen. That reproducibility gap is separate and must not be considered solved by KMD-352.
