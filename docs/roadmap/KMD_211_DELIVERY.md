# KMD-211 — Account recovery retention readiness

## Goal

Make the permissioned KMD-210 account-recovery retention status actionable for launch operations by distinguishing an unconfigured, intentionally disabled, not-yet-run, healthy, failing, or stale maintenance worker without exposing recovery data or adding a public health endpoint.

## Delivered

- adds bounded readiness states: `UNCONFIGURED`, `DISABLED`, `AWAITING_FIRST_RUN`, `HEALTHY`, `FAILING`, and `STALE`;
- exposes the effective bounded maintenance interval and the next expected run time when a run has occurred;
- marks a worker stale only after more than two configured maintenance intervals without a new attempt;
- marks a worker failing when its latest failure is newer than its latest success;
- keeps the existing `audit.read` permission boundary and read-only admin route;
- adds unit coverage for unconfigured, disabled, awaiting-first-run, healthy, and stale states;
- extends PostgreSQL E2E coverage to lock the bounded response shape.

## Privacy and security boundary

No e-mail, token, IP address, user agent, account identifier, recovery fingerprint, purge candidate, SQL detail, or audit-row content is exposed. The endpoint remains read-only and cannot run a purge or change retention configuration.

## Reliability boundary

Readiness remains process-local. `HEALTHY` means only that this process has attempted maintenance recently enough and its latest observed failure does not post-date its latest success. It does not prove centralized metrics, external alerting, scheduler availability outside this process, database backup, disaster recovery, e-mail delivery, DNS/TLS, production deployment, physical-device validation, legal review, or store publication.

`AWAITING_FIRST_RUN` is not treated as success because a freshly started process has no execution evidence yet. `STALE` is a bounded operational signal, not an external uptime guarantee.

## Migration

No Prisma migration. KMD-211 changes only in-process readiness projection, tests, and documentation.

## Validation gate

Before merge, the exact PR head must pass production dependency audit, Prisma generation, migrate deploy, zero migration drift, monorepo build, unit tests, Chromium Web E2E, and PostgreSQL API E2E.

## Rollback

Revert the KMD-211 merge commit. No database rollback is required. KMD-210 retains its permissioned maintenance status endpoint but loses the readiness classification, interval, and next-expected-run projection.
