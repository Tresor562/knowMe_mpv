# KMD-167 — Structured HTTP observability baseline

## Goal

Provide a production-oriented, privacy-minimized HTTP logging baseline that operators can centralize without leaking request bodies, query secrets, cookies, authorization headers or user data.

## Delivered

- API-wide completion logging through one middleware registered at bootstrap.
- One structured JSON event per completed HTTP request.
- Correlatable `x-request-id` response header.
- Bounded validation for client-supplied request IDs with server UUID fallback.
- Logged URL reduced to path only; query strings are excluded.
- Logged fields restricted to event name, request ID, method, path, status and duration.
- Unit tests for request-ID validation, query-string redaction and sensitive header/body minimization.
- Deployment documentation defining collection and privacy boundaries.

## Validation gate

Before merge, the exact branch head must pass the repository CI gate: dependency installation, Prisma generation/schema push, full monorepo build, unit tests, Chromium Web E2E and PostgreSQL API E2E.

## External evidence still required

This KMD does not claim that any production provider has been configured. Release operations must still prove, in the actual target environment:

- centralized collection of stdout JSON logs;
- encryption at rest and access controls for retained logs;
- retention/deletion policy;
- dashboards for availability, latency and HTTP error rates;
- actionable alerts and an on-call/escalation path;
- infrastructure metrics and provider-side health/probe configuration;
- SLO/SLA targets appropriate to the release.

## Privacy boundary

Do not expand these request logs to include request/response bodies, authorization headers, cookies, reset tokens, query strings, email addresses, user IDs or message contents without a separate privacy/security review and an explicit retention purpose.

## Rollback

Remove `createHttpObservabilityMiddleware()` registration from `apps/api/src/main.ts`. The middleware and its tests can then be removed independently. No database schema or migration rollback is required.
