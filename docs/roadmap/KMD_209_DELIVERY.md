# KMD-209 — Account recovery retention observability

## Goal

Make the KMD-208 account-recovery audit retention worker observable enough for launch operations without exposing a public maintenance endpoint or claiming external infrastructure monitoring.

## Delivered

- replaces the scheduled purge's silent error swallowing with structured NestJS logging;
- records an in-process maintenance snapshot containing whether retention is configured/enabled, the last attempt time, last successful run, last failed scheduled run and the last deletion count;
- successful empty purge passes are recorded as successes rather than being indistinguishable from a worker that never ran;
- deletion logging occurs only when records were actually removed;
- no recovery target fingerprint, IP address, user agent, e-mail, token or audit-row content is written into maintenance logs;
- unit coverage verifies maintenance state after successful deletion and the disabled-maintenance state.

## Privacy and security boundary

The snapshot contains operational timestamps and deletion counts only. It does not expose recovery identities, audit payloads or account data. No HTTP endpoint is added by this KMD.

## Reliability boundary

The snapshot is process-local and resets on process restart. It improves runtime diagnosis but is not a substitute for production metrics, centralized logs, uptime monitoring or an external scheduler. Those remain deployment/operations evidence outside this code-only milestone.

## Migration

No Prisma schema migration. KMD-209 changes only the in-process maintenance worker and its tests/documentation.

## Validation gate

Before merge, the exact head must pass production dependency audit, Prisma generation, migrate deploy, zero drift, monorepo build, unit tests, Chromium Web E2E and PostgreSQL API E2E.

## Rollback

Revert the KMD-209 merge commit. No database rollback is required. KMD-208 retention behavior remains available after rollback, but scheduled purge errors return to being non-observable in application logs.
