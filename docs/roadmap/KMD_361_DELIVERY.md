# KMD-361 — Non-root production runtime containers

## Goal

Reduce container-runtime privilege and make the production runtime intent explicit for both API and Web images without weakening KMD-359/KMD-360 dependency reproducibility.

## Changes

- `Dockerfile.api` and `Dockerfile.web` keep the frozen PNPM install introduced by KMD-360.
- Both images set `NODE_ENV=production` for the final runtime command.
- Both images switch to the image-provided unprivileged `node` user before startup.
- Build output ownership is transferred to `node:node` so the runtime does not require UID 0 merely to access application files.
- `scripts/runtime-container-security-preflight.test.mjs` rejects removal of the final non-root runtime declaration or production environment declaration.
- Canonical CI starts a shell in each built image and proves the effective runtime UID is non-zero and `NODE_ENV=production` before continuing to browser/API E2E.

## Migration

No database migration is required. This changes container runtime privilege only.

## Validation required before merge

- all existing supply-chain, package pinning, lockfile and runtime-container preflights pass;
- canonical frozen install and unsuppressed production dependency audit pass;
- Prisma generation, migration deploy and schema drift check pass;
- monorepo build and complete tests pass;
- API and Web runtime images build successfully;
- the effective user of each final image is non-root and the effective `NODE_ENV` is `production`;
- Web E2E and API E2E pass;
- no blocking review or unresolved review thread remains.

## Rollback

Revert the KMD-361 merge commit. Do not remove KMD-359's canonical lockfile or KMD-360's frozen Docker installs. If a production workload is later proven to require a writable path, add only the minimum owned directory on a dedicated reviewed branch rather than restoring root runtime globally.

## Proof boundaries

CI proves the built images use a non-root effective user and production environment in GitHub's runner, and that the repository's automated test suites still pass. It does not prove production orchestration securityContext settings, filesystem read-only enforcement, network policy, production health, supported-device physical validation, legal/privacy review, backup restoration, monitoring delivery, deployment, or store publication.
