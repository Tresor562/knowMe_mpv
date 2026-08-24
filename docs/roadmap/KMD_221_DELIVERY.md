# KMD-221 — API rate-limit release hardening

## Goal

Harden KnowMe's existing global HTTP throttling for a market release without pretending that repository code alone provides globally consistent DDoS protection or multi-instance quotas.

The API already used `@nestjs/throttler` globally, but the policy was hard-coded to 120 requests per 60 seconds and infrastructure health probes were subject to the same quota. KMD-221 makes the release policy explicit and prevents probe traffic from causing false 429-based readiness/liveness failures.

## Changes

- adds `createApiRateLimitPolicy()` with bounded development defaults and fail-closed production configuration;
- requires explicit production values for `API_RATE_LIMIT_TTL_MS` and `API_RATE_LIMIT_LIMIT`;
- bounds TTL to 1,000..3,600,000 ms and request limit to 1..100,000;
- replaces the hard-coded `ThrottlerModule` values with the validated policy;
- exempts only `/health`, `/health/live` and `/health/ready` from the default global throttler;
- keeps `/health/metrics` protected by its bearer token and subject to global throttling;
- adds a dedicated market-release preflight for the two throttle values;
- wires the preflight into `pnpm check:release` and its tests into the root test gate;
- adds API E2E coverage proving liveness remains available beyond the normal default quota.

## Security and reliability boundaries

The exemption is intentionally narrow. Business, authentication, messaging, media, gameplay, admin and metrics routes continue through the global `ThrottlerGuard` unless they already have their own stricter domain controls.

The health endpoints expose only the existing liveness/readiness payloads and do not grant access to user data or secrets. The metrics endpoint is not exempted.

The production policy fails closed when the throttle values are missing or malformed instead of silently using development defaults.

## Validation

Automated coverage verifies:

- development/test environments retain bounded defaults;
- production startup policy requires explicit values;
- valid bounded production values are accepted;
- zero, fractional, non-numeric and out-of-range values are rejected;
- release preflight requires both values and accepts only documented bounds;
- more requests than the legacy default quota can still reach `/health/live` without 429;
- existing API/unit/E2E suites remain part of the merge gate.

The repository merge gate remains production dependency audit, Prisma generation, `migrate deploy`, zero drift, complete monorepo build, root tests, Chromium Web E2E and PostgreSQL API E2E on the exact PR head.

## Migration

No Prisma migration and no persisted application-data migration are required.

Before a market release, operations must choose and configure:

- `API_RATE_LIMIT_TTL_MS`;
- `API_RATE_LIMIT_LIMIT`.

Those values must be chosen from measured/expected traffic and abuse patterns rather than copied blindly from development defaults.

## Rollback

Revert KMD-221 to restore the previous hard-coded global `120 requests / 60 seconds` policy and remove the release-preflight requirement and explicit probe exemptions. No database rollback is required. Reintroducing probe throttling may again create false health failures under sufficiently frequent probing.

## External evidence still required

KMD-221 does **not** prove:

- globally consistent rate limiting across multiple API instances;
- a shared Redis/distributed throttler store;
- trusted proxy/IP forwarding correctness in the target infrastructure;
- edge/WAF/DDoS protection;
- real load-test-derived thresholds or capacity limits;
- production monitoring/alerting of 429 rates;
- deployment, legal/privacy validation, physical-device validation or store publication.

The default Nest throttler storage is process-local. A horizontally scaled release must therefore validate a shared/distributed throttling topology or equivalent trusted edge enforcement before claiming a global quota. Those remain external deployment/release gates requiring real evidence.
