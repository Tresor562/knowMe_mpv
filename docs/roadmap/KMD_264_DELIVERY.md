# KMD-264 — Production metrics smoke verifier

## Goal

Verify after deployment that the production API exposes the bounded authenticated metrics surface expected by KnowMe operations.

## Delivered

- `pnpm release:metrics-smoke`;
- canonical HTTPS-origin validation;
- authenticated `GET /health/metrics` with the existing `METRICS_BEARER_TOKEN`;
- redirect refusal and bounded timeout;
- 64 KiB response ceiling;
- strict JSON/content-type validation;
- structural validation of request counters and latency metrics;
- deterministic tests wired into the root test gate.

## Migration

No Prisma migration is required.

Release operations provide the same production origin used by KMD-263 and the production metrics bearer token. The token remains server/operator-only and must not be persisted in market evidence.

## Rollback

Revert KMD-264. No product data is changed and the existing `/health/metrics` endpoint is unaffected.

## Proof boundary

A passing metrics smoke proves only that the deployed endpoint is reachable over HTTPS with the configured credential and returns a structurally valid snapshot at that moment. It does not prove that an external monitoring provider is configured, polling continuously, retaining data, alerting on-call staff, meeting an SLA, or that incident escalation works. Those remain external market-release evidence requirements.
