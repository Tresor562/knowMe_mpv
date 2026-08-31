# KMD-363 — Prove production runtime containers actually boot healthy

## Problem

KMD-362 embedded bounded liveness healthchecks in the API and Web runtime images and canonical CI verified the image metadata. Metadata inspection alone does not prove that the built production command can start successfully, remain running, and reach the declared health endpoint with the runtime environment expected by CI.

A market-ready release process must fail before merge when a production image builds but cannot actually boot.

## Delivery

- Keep the KMD-362 healthcheck definitions unchanged.
- After each production image build, canonical CI now launches that exact image as a detached container.
- API boot validation uses the CI PostgreSQL service through host networking and passes only CI-scoped `DATABASE_URL`, `JWT_SECRET`, and `PORT` values.
- Web boot validation launches the exact Web image on its production port.
- Both checks poll Docker's real container health state for at most 60 seconds.
- A container that becomes `unhealthy`, exits, or never becomes healthy fails the canonical `quality` job.
- Once healthy, CI also performs an HTTP request against the declared liveness route from the runner.
- Cleanup always removes the temporary container and emits container logs for diagnosis.
- A repository preflight test prevents later CI edits from silently removing the runtime boot proof or converting it into an unbounded wait.

## Tests and merge gates

KMD-363 is complete only when exact-head CI passes all existing gates plus:

1. the new runtime-container boot preflight;
2. actual API image boot and healthy transition;
3. actual Web image boot and healthy transition;
4. direct HTTP success from both `/health/live` endpoints;
5. all supply-chain, lockfile, audit, Prisma migration/drift, build, unit, Docker identity/metadata, Web E2E and API E2E gates.

No merge is allowed with a blocking review or unresolved review thread.

## Migration

No Prisma, user-data, API-contract or client migration is required. This KMD changes only CI release verification.

## Rollback

Revert the KMD-363 commits. That restores KMD-362 behavior where CI builds both runtime images and inspects their healthcheck metadata without starting the production containers. No persistent data rollback is required.

## Operational and proof boundary

KMD-363 proves that the exact images built in GitHub Actions can boot and satisfy their declared liveness healthchecks in the CI environment. It does not prove production orchestration, production secrets, production databases, network policies, alert delivery, backup restoration, physical-device behavior, legal/privacy compliance, production deployment, or App Store / Google Play publication.

Canonical `main` branch protection also remains an external repository-governance requirement and must not be claimed complete until GitHub reports the required protection configuration.
