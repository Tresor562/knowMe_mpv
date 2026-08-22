# KMD-178 — Graceful API shutdown

## Goal

Prevent abrupt API termination during deployments or operator shutdowns by enabling NestJS lifecycle hooks for `SIGTERM` and `SIGINT`.

## Delivery

- `apps/api/src/main.ts` registers the centralized graceful-shutdown policy before listening for traffic.
- `apps/api/src/common/graceful-shutdown.ts` owns the allowed shutdown signals.
- Prisma already implements `OnModuleDestroy`, so a Nest shutdown now reaches `$disconnect()` instead of relying on process termination alone.
- Unit tests verify the exact signal set and that callers cannot mutate the exported policy.

## Operational behavior

On `SIGTERM` or `SIGINT`, NestJS closes the application and invokes registered lifecycle hooks. This is required for clean resource release during rolling deploys and controlled restarts.

The platform must still provide a termination grace period long enough for in-flight requests and lifecycle hooks to finish. This repository change does not prove that Render, Kubernetes, a VM supervisor, or any other production provider is configured with a sufficient grace period.

## Validation gate

Before merge, the exact branch head must pass:

1. dependency installation;
2. Prisma generate/push against PostgreSQL;
3. monorepo build;
4. unit tests;
5. Chromium Web E2E;
6. PostgreSQL API E2E.

A provider-level termination drill remains external evidence and must not be claimed without a real deployment test.

## Rollback

Revert the KMD-178 merge commit. This removes the explicit shutdown-hook registration and returns the API bootstrap to the previous process-termination behavior. No schema or data migration is involved.

## Remaining production proof

- configure the hosting platform termination grace period;
- perform a real rolling-restart/termination drill;
- verify readiness removes the instance from traffic before forced termination;
- confirm no request corruption or connection leak under real provider shutdown behavior.
