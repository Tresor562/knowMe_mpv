# KMD-362 — Runtime liveness healthchecks

## Goal

Make both production runtime images explicitly observable by container runtimes without weakening KMD-359/KMD-360 dependency reproducibility or KMD-361 non-root execution.

## Changes

- API image declares a bounded Docker `HEALTHCHECK` against the existing public process-liveness endpoint `GET /health/live` on port 4000.
- Web image exposes a minimal dynamic, non-cacheable `GET /health/live` route and declares a bounded Docker `HEALTHCHECK` against it on port 3000.
- Both probes use the image-pinned Node runtime rather than adding curl/wget packages or new registry dependencies.
- `scripts/runtime-container-healthcheck-preflight.test.mjs` guards the probe endpoints and timing policy.
- Canonical CI inspects both built images and proves the expected healthcheck command is embedded in image metadata before E2E proceeds.

## Migration

No database migration is required. This delivery changes runtime image metadata and adds one stateless Web liveness route.

## Validation required before merge

- all existing supply-chain, package pinning, lockfile, runtime install and non-root preflights pass;
- the new healthcheck preflight passes;
- frozen install and unsuppressed production dependency audit pass;
- Prisma generation, migration deploy and schema drift check pass;
- monorepo build and complete tests pass;
- API and Web images build successfully and remain non-root with `NODE_ENV=production`;
- built image metadata contains the expected API and Web liveness probes;
- Web E2E and API E2E pass;
- no blocking review or unresolved review thread remains.

## Rollback

Revert the KMD-362 merge commit. This removes only the two image healthchecks, the Web liveness route, CI/preflight enforcement and delivery documentation. Do not revert the canonical lockfile, frozen installs or non-root runtime hardening from KMD-359 through KMD-361.

## Proof boundaries

CI can prove the images build, contain the intended healthcheck metadata and keep the existing automated suites green. It does not prove that a real production orchestrator consumes Docker health metadata, that live traffic routing reacts correctly, or that production monitoring/alert delivery works. Those require deployment-specific evidence. Physical-device validation, legal/privacy review, backup restoration, production deployment and store publication remain separate evidence boundaries.
