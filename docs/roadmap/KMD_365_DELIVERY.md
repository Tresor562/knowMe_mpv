# KMD-365 — Background scheduler outage resilience

## Problem

KMD-364 proved the production API can survive and recover from a PostgreSQL outage after fixing the 15-second call-maintenance scheduler that detached a rejecting database promise. A follow-up source audit found the same failure shape in other database-backed periodic jobs: game-session maintenance, social matchmaking maintenance, creator-metrics retention, and both Profile Circle notification schedulers.

A recoverable dependency outage must not become a process crash merely because a background scheduler happens to execute while PostgreSQL is unavailable.

## Delivery

KMD-365 routes each affected timer/bootstrap invocation through a scheduler-owned async boundary that catches transient failures and retries naturally on the next interval while preserving explicit/manual method rejection semantics.

Affected services:

- `GameSessionMaintenanceService`;
- `SocialMatchmakingMaintenanceService`;
- `CreatorMetricsRetentionService`;
- `ProfileCircleNotificationSchedulerService`;
- `ProfileCircleNotificationResilienceSchedulerService`.

Workers already containing their own scheduled failures are intentionally left unchanged.

The dedicated runtime-readiness proof is strengthened to hold PostgreSQL unavailable for 75 seconds after readiness has reached `503`. During that sustained outage it samples the exact production API every five seconds and requires the container to remain running, liveness to remain `200`, and readiness to remain `503`. This exercises the common 15-second/60-second scheduler cadence against a real database outage rather than only unit mocks. Creator retention has a much longer default cadence, so its scheduler boundary is covered directly by the focused unit regression and structural preflight instead of inflating CI by hours.

## Tests and merge gates

KMD-365 is complete only when the exact PR head has:

- canonical CI green, including build, unit tests and API/Web E2E;
- `scheduler-outage-resilience.spec.ts` green for all five affected services;
- scheduler structural preflight green;
- dedicated `Runtime readiness` green with the sustained 75-second PostgreSQL outage;
- dependency recovery back to readiness `200` without API restart;
- no blocking review or unresolved review thread.

## Migration

No Prisma schema, user-data or public API migration is required.

## Rollback

Revert the five scheduler-boundary changes, focused regression, scheduler preflight and sustained-outage extension. No persistent-data rollback is required. KMD-364 readiness behavior remains the minimum previous baseline.

## Proof boundary

A green KMD-365 proves containment for the targeted scheduler boundaries and a sustained PostgreSQL outage in GitHub Actions. It does not prove every external dependency failure, production PostgreSQL failover, orchestrator/load-balancer wiring, production monitoring, backup/restore, legal/privacy approval, physical-device validation, deployment or store publication.
