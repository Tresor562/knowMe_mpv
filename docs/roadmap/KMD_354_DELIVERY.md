# KMD-354 — Pin exact Node runtime in canonical CI

## Goal

Remove the remaining mutable Node major-version selector from the canonical GitHub Actions workflow so CI executes on the same audited Node patch line as the production runtime containers.

## Changes

- change `actions/setup-node` configuration from `node-version: 22` to `node-version: 22.23.2`;
- extend the CI supply-chain preflight so a regression back to the mutable major line is rejected;
- keep the already pinned GitHub Actions, PostgreSQL CI image, runtime Node container images and compose PostgreSQL image unchanged.

## Validation

Required before merge:

1. canonical GitHub Actions must complete successfully on the exact PR head;
2. the supply-chain preflight must pass with `node-version: 22.23.2` and reject `node-version: 22`;
3. the normal repository build, unit tests, Web E2E and API E2E contained in the canonical `quality` job must remain green;
4. review and review-thread gates must be clear.

## Migration

No database, schema, data or API migration is required.

## Rollback

Revert this delivery to restore the previous CI Node selector. A rollback intentionally reintroduces major-line mutability and therefore should only be temporary while investigating runner compatibility.

## Proof boundary

This delivery proves only the repository-level CI configuration and its exact-head automated validation. It does not prove production deployment, physical-device compatibility, legal/privacy approval, backup/restore execution, external monitoring delivery or App Store / Google Play publication.

## Separate unresolved dependency reproducibility gap

The repository still does not contain a committed `pnpm-lock.yaml`, so installs continue with `--frozen-lockfile=false`. KMD-354 does not claim to solve that independent gap; a canonical lockfile must be generated and validated rather than fabricated manually.
