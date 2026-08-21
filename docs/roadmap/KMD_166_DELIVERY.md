# KMD-166 — Production readiness probes

## Goal

Prevent production traffic from being routed to an API process that is alive but cannot reach PostgreSQL.

## Delivered

- `GET /health` remains a dependency-free compatibility/liveness response.
- `GET /health/live` explicitly reports process liveness and does not query PostgreSQL.
- `GET /health/ready` executes a minimal PostgreSQL `SELECT 1` through Prisma.
- Readiness returns `503 Service Unavailable` when PostgreSQL cannot answer.
- Database exception text, connection strings and credentials are never returned by the readiness response.
- Unit coverage verifies liveness isolation, successful readiness and fail-closed behavior.

## Deployment contract

Use `/health/live` for process/container liveness. A liveness failure means the process itself should be restarted.

Use `/health/ready` for load-balancer or orchestrator readiness. A readiness failure means the instance must receive no user traffic while it is unable to serve database-backed requests.

Do not use readiness as a destructive migration gate and do not expose detailed infrastructure diagnostics in these public endpoints.

## Validation gate

Before merge, require the repository CI on the exact branch head to pass:

1. dependency install and Prisma generation/push;
2. monorepo build;
3. full unit suite including `health.controller.spec.ts`;
4. Chromium Web E2E;
5. PostgreSQL API E2E.

A real orchestrator/load-balancer configuration is external deployment proof and must not be claimed by this KMD without evidence from the target environment.

## Rollback

Revert the KMD-166 commit(s). The legacy `/health` route remains backwards compatible throughout this block; rollback removes only the explicit `/health/live` and database-aware `/health/ready` behavior.

No Prisma schema or migration change is introduced by KMD-166.
