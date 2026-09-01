# KMD-364 — Prove runtime readiness dependency loss and recovery

## Problem

KMD-363 proved that the exact production API and Web images can boot, stay alive and satisfy their liveness checks in canonical CI. KnowMe already exposes `GET /health/ready`, which performs a minimal PostgreSQL `SELECT 1`, but the production-image proof did not yet demonstrate the traffic-shedding contract against a real dependency outage.

A market release must distinguish process liveness from traffic readiness. A healthy process whose PostgreSQL dependency is unavailable must remain alive while returning `503` from readiness so an orchestrator/load balancer can remove it from service without incorrectly restarting the process.

## Delivery

KMD-364 adds a dedicated exact-head GitHub Actions proof that:

1. starts a pinned PostgreSQL 16.15 container on an isolated loopback port;
2. installs dependencies with the canonical frozen PNPM lockfile;
3. generates Prisma and applies committed migrations to that isolated database;
4. builds the exact production `Dockerfile.api` image;
5. starts that image with the same explicit production guards used by the KMD-363 runtime proof;
6. requires both `/health/live` and `/health/ready` to reach HTTP 200 initially;
7. stops PostgreSQL and requires the API process to keep returning HTTP 200 from liveness while readiness becomes HTTP 503;
8. restarts PostgreSQL and requires readiness to recover to HTTP 200 without restarting the API process;
9. bounds every wait loop and always removes temporary API/database containers;
10. never prints readiness response bodies, database exceptions, connection strings or credentials as proof material.

A repository-local structural preflight locks these invariants so the readiness proof cannot silently degrade into another liveness-only check.

## Why this is launch-critical

`/health/live` answers whether the process should be restarted. `/health/ready` answers whether the instance should receive user traffic. They must not be interchangeable. KMD-364 proves the intended behavior using the exact production API image and a real PostgreSQL outage/recovery cycle rather than mocks.

## Tests and merge gates

KMD-364 is complete only when the exact current PR head has:

- the canonical `CI` workflow green;
- the dedicated `Runtime readiness` workflow green;
- the KMD-364 structural preflight green;
- exact production API image build success;
- initial liveness/readiness success;
- dependency-loss evidence of liveness `200` plus readiness `503`;
- dependency recovery to readiness `200` without API restart;
- no blocking review and no unresolved review thread.

No earlier workflow run validates a newer head.

## Migration

No Prisma schema, user-data or public API migration is required. The existing `/health/ready` contract is unchanged. KMD-364 adds release validation only.

## Rollback

Revert the KMD-364 workflow, structural preflight and delivery documentation. The product returns to the KMD-363 state where runtime boot/liveness is proven but dependency-loss/recovery readiness behavior is not an exact production-image merge gate. No persistent-data rollback is required.

## Proof boundary

A green KMD-364 proves only the API image behavior against an isolated PostgreSQL outage and recovery inside GitHub Actions. It does **not** prove production load-balancer/orchestrator probe configuration, real production PostgreSQL failover, network partitions, production backup/restore, alert delivery, object-storage durability, legal/privacy approval, supported physical devices, deployment or store publication. Those claims remain external until independently evidenced.
