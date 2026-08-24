# KMD-210 — Account recovery operations status

## Goal

Expose the KMD-209 account-recovery retention maintenance snapshot to authorized KnowMe operators without creating a public health surface, a remote purge control, or a second source of retention truth.

## Delivered

- exports the existing `AccountRecoveryRetentionService` through `AuthModule`;
- wires `AdminModule` to the existing auth provider rather than duplicating maintenance state;
- adds `GET /admin/operations/account-recovery-retention`;
- protects the route with the existing JWT guard and `audit.read` permission;
- returns only `configured`, `enabled`, `lastAttemptAt`, `lastSuccessAt`, `lastFailureAt`, and `lastDeleted`;
- adds PostgreSQL-backed E2E coverage proving unauthenticated callers receive 401, ordinary authenticated users receive 403, and an authorized administrator can read only the bounded status shape.

## Privacy and security boundary

The endpoint exposes no e-mail address, recovery target fingerprint, token, IP address, user agent, audit row, account identifier, SQL details, or purge candidate. It cannot trigger a purge or mutate retention configuration.

The existing permission system remains authoritative. Client-supplied role or permission headers are not trusted.

## Reliability boundary

The returned status remains process-local and resets after process restart. A successful HTTP response proves only that the current process can expose its in-memory KMD-209 state. It does not prove that centralized logging, uptime monitoring, an external scheduler, backups, disaster recovery, e-mail delivery, DNS/TLS, or production deployment are configured.

## Migration

No Prisma schema migration. KMD-210 changes dependency wiring, one permissioned read-only endpoint, E2E coverage, and documentation only.

## Validation gate

Before merge, the exact PR head must pass:

- production dependency audit for high/critical advisories;
- Prisma client generation;
- committed migration deployment against PostgreSQL;
- zero Prisma migration drift;
- monorepo build;
- unit tests;
- Chromium Web E2E;
- PostgreSQL API E2E including the new operations-status authorization test.

## Rollback

Revert the KMD-210 merge commit. No database rollback is required. KMD-209 logging and internal maintenance snapshot behavior remain intact; only the permissioned operational read endpoint and module export are removed.
