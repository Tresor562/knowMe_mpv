# KMD-169 — Aggregate runtime HTTP metrics

## Goal

Add a provider-neutral, privacy-minimized runtime metrics baseline so release operators can measure aggregate API traffic, HTTP error classes and latency without collecting user identifiers, route values, request bodies, query strings or credentials.

## Delivered

- Aggregate in-process HTTP request counters grouped only by broad status class: 2xx, 4xx, 5xx and other.
- Fixed cumulative latency buckets at 100 ms, 250 ms, 500 ms, 1 s, 2.5 s and 5 s, plus count, sum and max.
- `GET /health/metrics` exposes service name, process uptime and the aggregate snapshot without touching PostgreSQL.
- The existing HTTP completion middleware records one metric sample when the response finishes.
- Non-finite and negative durations are sanitized before aggregation.
- Unit coverage proves low-cardinality output and the absence of request IDs, methods and paths.

## Privacy and cardinality boundary

KMD-169 intentionally does not label metrics by user ID, account, email, request ID, URL, path, route parameter, conversation, message, IP address, user agent or HTTP method. This avoids PII leakage and unbounded cardinality. Any future dimension must receive a separate privacy and operational review.

## Operational boundary

The counters are process-local and reset on restart. They are suitable as a release baseline and as a scrape/source endpoint for external observability, but they are not a durable metrics store. This KMD does not claim that a production collector, dashboard, alert, retention policy or on-call integration has been configured.

Operators must still validate in the real target environment:

- collection/scraping of the metrics endpoint;
- access-control policy appropriate to the deployment network;
- durable time-series retention;
- dashboards for availability, latency and HTTP 5xx rate;
- alert thresholds, escalation path and SLOs;
- provider-side infrastructure metrics.

## Validation gate

Before merge, the exact branch head must pass dependency installation, Prisma setup, the full monorepo build, unit tests, Chromium Web E2E and PostgreSQL API E2E.

## Rollback

Remove the runtime metric recording call and `GET /health/metrics`, then remove the metric helpers/tests. No database schema or migration rollback is required.
