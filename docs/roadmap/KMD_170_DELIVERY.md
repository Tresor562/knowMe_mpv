# KMD-170 — Protected runtime metrics

## Goal

Keep the aggregate runtime telemetry added in KMD-169 usable by an operator or collector without exposing operational metrics anonymously on the public API.

## Delivered

- `GET /health/metrics` now requires `Authorization: Bearer <METRICS_BEARER_TOKEN>`.
- The configured token must be at least 32 characters.
- Token comparison uses Node.js `timingSafeEqual` after an exact byte-length check.
- Missing or weak server configuration fails the metrics endpoint closed with a privacy-safe 503 response.
- Missing or invalid collector credentials fail with a privacy-safe 401 response and no metrics payload.
- Liveness and readiness probes remain independent of the metrics collector credential.
- Production `pnpm check:release` now requires `METRICS_BEARER_TOKEN` so a market release cannot silently expose or disable the protected telemetry endpoint through missing configuration.
- Unit tests cover valid, missing, malformed, wrong and weak credentials and verify the token never appears in a returned metrics payload.

## Security boundary

`METRICS_BEARER_TOKEN` is an operator secret. It must remain server-side and must not be placed in Web/Mobile bundles, source control, URLs, query strings, logs or screenshots. Collectors should send it only in the HTTPS `Authorization` header.

This token grants access only to the low-cardinality process-local metrics endpoint. It is not an application user credential, does not grant database access, and does not alter KnowMe account, moderation, Nexus, payment or product permissions.

## Production work that still needs real evidence

This KMD does not claim that a production metrics collector is already deployed. Before a release is called production-ready, operators still need evidence for:

- a real collector/scraper configured with the secret through the provider secret store;
- HTTPS and network exposure appropriate to the deployment;
- durable time-series retention;
- dashboards for availability, latency and 5xx rate;
- alert thresholds, escalation ownership and an SLO policy;
- secret rotation/revocation procedure;
- provider-side host/database metrics.

## Validation gate

Before merge, the exact branch head must pass dependency installation, Prisma setup, the full monorepo build, unit tests, Chromium Web E2E and PostgreSQL API E2E.

## Rollback

Revert KMD-170 to restore the KMD-169 endpoint behavior and remove the `METRICS_BEARER_TOKEN` release-preflight requirement. No database schema or migration rollback is required. A rollback to anonymous metrics should only be used in a non-public trusted environment because it weakens operational privacy.
