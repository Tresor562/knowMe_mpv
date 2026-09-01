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

The outage proof exposed a real product-side resilience defect in `CallMaintenanceService`: its default 15-second timer detached `tick()` with `void` and no rejection handler. A transient Prisma/database failure could therefore become an unhandled promise rejection and terminate the Node process even though the HTTP readiness boundary correctly returned `503`. KMD-364 now contains scheduled call-maintenance failures, logs only the error class rather than the exception message, and retries naturally on the next interval. Direct/manual `tick()` callers still receive failures normally; only the detached scheduler boundary owns containment.

A focused unit regression proves a failed scheduled tick is contained and that the service can execute a later successful tick. The structural readiness preflight also rejects reintroduction of the naked detached `tick()` pattern.

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
- Therefore the remaining uncertainty was specifically dependency recovery, not initial boot or traffic shedding.

### Exact head `acef6bd02395a72421c0158338e846971671a343`

- Canonical CI #1396: **success**.
- Runtime readiness #7: **failure**.
- Initial production-image startup/readiness: **success**.
- PostgreSQL loss semantics (`live=200`, `ready=503`): **success**.
- PostgreSQL restarted and remained `running`; the host-path probe succeeded before API recovery was evaluated.
- The API container then became `exited`, so the proof failed immediately rather than misreporting a slow recovery.
- Source inspection identified the default 15-second `CallMaintenanceService` timer as a detached async database maintenance boundary without rejection containment. This matches the outage timing and is a real runtime defect independent of the health controller.

### Runtime resilience correction after Runtime readiness #7

`CallMaintenanceService` now routes timer-driven execution through a scheduler-owned `runScheduledTick()` boundary. That boundary catches transient failures, emits a secret-safe error-class diagnostic and leaves the process alive for the next interval. The public `tick()` method is intentionally unchanged in semantics so explicit callers can still observe failures.

The recovery gate continues to separate PostgreSQL container restart from actual reachability through the published host endpoint (`127.0.0.1:55432`). The API recovery window remains explicitly bounded at 120 seconds, continuously requires both API and PostgreSQL containers to remain running, and requires the API container ID to remain unchanged. No timeout was widened and no readiness behavior was weakened as part of the runtime fix.

## Why this is launch-critical

`/health/live` answers whether the process should be restarted. `/health/ready` answers whether the instance should receive user traffic. They must not be interchangeable. KMD-364 proves the intended behavior using the exact production API image and a real PostgreSQL outage/recovery cycle rather than mocks. It now also proves a periodic database-backed maintenance task cannot turn that recoverable dependency outage into a process crash.

## Tests and merge gates

KMD-364 is complete only when the exact current PR head has:

- the canonical `CI` workflow green;
- the dedicated `Runtime readiness` workflow green;
- the KMD-364 structural preflight green;
- the focused call-maintenance outage regression green;
- exact production API image build success;
- initial liveness/readiness success;
- dependency-loss evidence of liveness `200` plus readiness `503`;
- independently proven PostgreSQL host-path recovery;
- dependency recovery to readiness `200` without API restart within the bounded recovery window;
- unchanged API container identity across the outage/recovery cycle;
- no blocking review and no unresolved review thread.

No earlier workflow run validates a newer head.

## Migration

No Prisma schema, user-data or public API migration is required. The existing `/health/ready` contract is unchanged. KMD-364 changes only runtime resilience and release validation.

## Rollback

Revert the KMD-364 workflow, structural preflight, call-maintenance scheduler containment, focused regression and delivery documentation. The product returns to the KMD-363 state where runtime boot/liveness is proven but dependency-loss/recovery readiness behavior is not an exact production-image merge gate. No persistent-data rollback is required.

## Proof boundary

A green KMD-364 proves only the API image behavior against an isolated PostgreSQL outage and recovery inside GitHub Actions. It does **not** prove production load-balancer/orchestrator probe configuration, real production PostgreSQL failover, network partitions of every shape, production backup/restore, alert delivery, object-storage durability, legal/privacy approval, supported physical devices, deployment or store publication. Those claims remain external until independently evidenced.
