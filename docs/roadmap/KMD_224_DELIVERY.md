# KMD-224 — Runtime rate-limit topology guard

## Goal

Keep the market-release rate-limit safety introduced by KMD-223 enforceable at API startup, not only in the offline release preflight.

The current Nest throttler storage is process-local. A production API that starts with more than one application instance would therefore have independent counters per process and must not be treated as if one global quota existed.

## Changes

- production startup now requires `API_INSTANCE_COUNT` to be explicitly configured;
- the runtime accepts only the canonical value `1` while throttling remains process-local;
- malformed values such as `01`, fractions, negative values or text fail closed;
- values greater than one fail startup with an actionable message requiring a validated shared or edge limiter first;
- non-production behavior remains unchanged and keeps the bounded development defaults;
- API rate-limit policy tests cover the production topology boundary as well as existing TTL/limit validation.

## Why runtime enforcement is needed

KMD-223 already made `pnpm check:release` reject unsupported horizontal scaling. Deployment systems can still be misconfigured, bypass a manual preflight, or start a container with different environment values than the values that were checked earlier. KMD-224 therefore repeats the security-critical topology invariant in the runtime path used to configure the throttler.

## Migration

No Prisma migration and no persisted user-data change.

For a production release using the current process-local throttler, set:

```text
API_INSTANCE_COUNT=1
```

Only set that value when the real deployment actually runs one API application process.

## Rollback

Revert KMD-224. KMD-223's release preflight remains in place, but production startup would no longer independently enforce the same topology invariant.

## Deliberate boundary

This milestone does not implement Redis/distributed throttling, edge enforcement, WAF/DDoS protection, autoscaling control, load-balancer configuration, or production topology discovery. It also does not prove that the actual deployment has exactly one process. That remains an operational/infrastructure fact that must be verified in the target environment.

## Merge gate

Merge only after the exact PR head passes the repository CI gate: production dependency audit, Prisma generation, migration deploy, zero drift, complete monorepo build, root tests, Chromium Web E2E and PostgreSQL API E2E.
