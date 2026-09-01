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
8. restarts PostgreSQL, first proves the published host endpoint is reachable again, then requires readiness to recover to HTTP 200 without restarting the API process;
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

### Exact head `060e78f71064f72d05d3e12663e679c08cbf222d`

- Canonical CI #1393: **success**.
- Runtime readiness #4: **failure**.
- Initial production-image startup/readiness: **success**.
- PostgreSQL loss semantics (`live=200`, `ready=503`): **success**.
- Recovery step: **failure after its bounded 60-second window**.
- Therefore the remaining uncertainty is specifically dependency recovery, not initial boot or traffic shedding.

### Recovery-proof hardening after Runtime readiness #4

The recovery gate now separates two different phenomena that the previous loop conflated:

1. PostgreSQL container restart versus actual reachability through the published host endpoint (`127.0.0.1:55432`);
2. API/Prisma readiness recovery after that host endpoint is proven reachable.

It uses the same pinned PostgreSQL image as a host-network `pg_isready` probe before starting the API recovery clock. The API recovery window is explicitly bounded at 120 seconds, continuously requires both API and PostgreSQL containers to remain running, and still requires the API container ID to remain unchanged. This is a diagnostic/validation hardening, not a product-side fallback and not a weakening of the fail-closed readiness contract.

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
- independently proven PostgreSQL host-path recovery;
- dependency recovery to readiness `200` without API restart within the bounded recovery window;
- unchanged API container identity across the outage/recovery cycle;
- no blocking review and no unresolved review thread.

No earlier workflow run validates a newer head.

## Migration

No Prisma schema, user-data or public API migration is required. The existing `/health/ready` contract is unchanged. KMD-364 adds release validation only.

## Rollback

Revert the KMD-364 workflow, structural preflight and delivery documentation. The product returns to the KMD-363 state where runtime boot/liveness is proven but dependency-loss/recovery readiness behavior is not an exact production-image merge gate. No persistent-data rollback is required.

## Proof boundary

A green KMD-364 proves only the API image behavior against an isolated PostgreSQL outage and recovery inside GitHub Actions. It does **not** prove production load-balancer/orchestrator probe configuration, real production PostgreSQL failover, network partitions, production backup/restore, alert delivery, object-storage durability, legal/privacy approval, supported physical devices, deployment or store publication. Those claims remain external until independently evidenced.
