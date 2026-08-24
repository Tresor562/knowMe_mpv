# KMD-212 — Backup restore manifest hardening

## Goal

Reduce the risk of restoring the wrong, malformed, stale or metadata-inconsistent PostgreSQL dump during an incident or recovery rehearsal without claiming that production backup infrastructure exists.

## Delivered

- validates the supported backup manifest schema before `pg_restore`;
- requires the manifest to describe a PostgreSQL custom dump containing sensitive data;
- binds the manifest file name to the exact `.dump` selected for restore;
- requires a canonical 64-character SHA-256 value before the existing byte-level integrity comparison;
- rejects invalid `createdAt` values and timestamps unexpectedly in the future;
- adds optional `--max-age-hours <positive number>` to enforce a recovery exercise freshness/RPO window;
- keeps `RESTORE_DATABASE_URL` and the destructive `--confirm RESTORE_KNOWME` guard unchanged;
- adds unit coverage for manifest identity, schema, format, SHA-256, timestamp and freshness behavior;
- documents the operational boundary in `docs/DEPLOYMENT.md`.

## Security and privacy boundary

The backup manifest does not store the database URL, credentials or user records. Dumps remain sensitive and must be encrypted and access-controlled outside the repository.

`--max-age-hours` is a local validation of the selected manifest timestamp. It is not evidence that backups are remotely scheduled, replicated, encrypted, retained or restorable in production.

## Migration

No Prisma migration is required.

## Validation gate

Before merge, the exact PR head must pass the repository CI gate: production dependency audit, Prisma generation, production migration deployment, zero drift, monorepo build, unit tests, Chromium Web E2E and PostgreSQL API E2E.

A real disaster-recovery rehearsal remains external and must not be marked complete without an actual isolated restore and measured RPO/RTO.

## Rollback

Revert KMD-212. The KMD-165 backup/restore flow then returns to its previous manifest SHA-256-only validation. No database schema or persisted application data is changed by this delivery.
