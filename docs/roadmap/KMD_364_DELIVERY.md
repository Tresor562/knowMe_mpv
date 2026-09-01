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
9. proves the API container identity is unchanged across dependency recovery;
10. bounds every wait loop and always removes temporary API/database containers;
11. never prints readiness response bodies, database exceptions, connection strings or credentials as proof material.

A repository-local structural preflight locks these invariants so the readiness proof cannot silently degrade into another liveness-only check.

The workflow deliberately keeps initial readiness, dependency loss and dependency recovery as separate named GitHub Actions steps. This makes a future failure attributable to one phase from workflow metadata alone without requiring response-body or secret-bearing log collection.

## Validation history

### Exact head `bfea12b80986fec1c4b3006971eab64e1f15b5b3`

- Canonical CI #1390: **success**.
- Runtime readiness #1: **failure**.
- The structural preflight, frozen install, Prisma generation, isolated PostgreSQL startup, committed migrations and exact API image build all passed.
- The failure occurred inside the original monolithic `Prove readiness dependency loss and recovery` step after the image build. GitHub workflow metadata available to the integration could not distinguish whether the failure was initial readiness, dependency-loss semantics or recovery.
- No product/runtime behavior was declared broken from that ambiguous result.

### Traceability correction

The readiness proof was split into three independently named gates while preserving the same required HTTP semantics:

1. `Start exact API image and require initial readiness`;
2. `Prove PostgreSQL loss keeps liveness and sheds readiness`;
3. `Prove readiness recovers after PostgreSQL returns without API restart`.

Cleanup is now a separate `if: ${{ always() }}` step. The recovery gate additionally checks that the API container ID remains unchanged, preventing a hidden restart from satisfying the recovery proof.

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
- unchanged API container identity across the outage/recovery cycle;
- no blocking review and no unresolved review thread.

No earlier workflow run validates a newer head.

## Migration

No Prisma schema, user-data or public API migration is required. The existing `/health/ready` contract is unchanged. KMD-364 adds release validation only.

## Rollback

Revert the KMD-364 workflow, structural preflight and delivery documentation. The product returns to the KMD-363 state where runtime boot/liveness is proven but dependency-loss/recovery readiness behavior is not an exact production-image merge gate. No persistent-data rollback is required.

## Proof boundary

A green KMD-364 proves only the API image behavior against an isolated PostgreSQL outage and recovery inside GitHub Actions. It does **not** prove production load-balancer/orchestrator probe configuration, real production PostgreSQL failover, network partitions, production backup/restore, alert delivery, object-storage durability, legal/privacy approval, supported physical devices, deployment or store publication. Those claims remain external until independently evidenced.
