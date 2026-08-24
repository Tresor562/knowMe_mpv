# KMD-223 — Single-instance rate-limit release safety

## Goal

Prevent a KnowMe market release from horizontally scaling the API while relying on the current process-local NestJS throttler and then incorrectly treating per-process quotas as one global anti-abuse limit.

## Changes

- `API_INSTANCE_COUNT` is now an explicit release-topology input.
- `pnpm check:release` fails when `API_INSTANCE_COUNT` is missing or malformed.
- While KnowMe uses the default process-local throttler store, the only accepted market-release value is `API_INSTANCE_COUNT=1`.
- Values greater than one fail closed and instruct operations to deploy a validated shared or trusted-edge limiter before horizontal scaling.
- `.env.example` documents the topology boundary next to the KMD-221 rate-limit settings.
- Root release-preflight tests cover missing, malformed, non-canonical and horizontally scaled values.

## Why this is required

KMD-221 made the global HTTP throttle policy explicit, but its storage is still local to each API process. With two independent instances, a client could effectively receive separate counters from each process depending on routing. That is not a single global quota and must not be represented as one during launch readiness.

KMD-223 therefore chooses correctness over pretending horizontal scaling is already supported by the application-level limiter.

## Release configuration

Until a later KMD introduces and validates shared/distributed rate-limit authority or equivalent edge enforcement:

```env
API_INSTANCE_COUNT=1
```

The value is a release assertion, not an autoscaling control. It does not configure the hosting provider or prevent an operator from creating more instances outside KnowMe. Operations must ensure the deployed topology actually matches the asserted value.

## Security and reliability boundary

KMD-223 does not provide Redis/distributed throttling, WAF/DDoS protection, sticky routing, CDN rate limiting, autoscaling control, firewall rules, ingress verification or load-test-derived limits.

If production needs more than one API instance, release validation must remain blocked until a shared limiter or equivalent trusted edge policy is implemented and independently validated.

## Validation

The exact PR head must pass the normal repository merge gate:

1. production dependency audit;
2. Prisma generation;
3. `prisma migrate deploy`;
4. migration drift verification;
5. complete monorepo build;
6. root unit/release-preflight tests;
7. Chromium Web E2E;
8. PostgreSQL API E2E.

Focused tests additionally verify that only canonical `API_INSTANCE_COUNT=1` is accepted while throttling remains process-local.

## Migration

No Prisma or persisted-user-data migration is required.

Before a market release, set `API_INSTANCE_COUNT=1` only when the real deployment has exactly one API process. Do not use this variable to hide a multi-instance topology.

## Rollback

Revert KMD-223 and remove `API_INSTANCE_COUNT` from the release configuration. This restores the previous behavior where release preflight cannot detect accidental horizontal scaling with a process-local throttle store.

## Evidence not claimed

No real deployment topology, autoscaler, load balancer, CDN/WAF policy, shared rate-limit store, production load test, DDoS exercise, physical-device validation, legal review, store review or public production release is claimed by this KMD.
