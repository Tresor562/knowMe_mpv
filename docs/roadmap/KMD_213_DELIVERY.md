# KMD-213 — Restore target isolation guard

## Goal

Reduce the risk that an operator running an isolated PostgreSQL restore drill accidentally points `RESTORE_DATABASE_URL` at the same logical database target as the configured primary `DATABASE_URL`.

## Behavior

`pnpm db:restore` now compares the normalized PostgreSQL host, port and database name of `RESTORE_DATABASE_URL` with `DATABASE_URL` when the latter is present.

- Different target: restore may continue through the existing confirmation, manifest, freshness and SHA-256 gates.
- Same target: restore fails closed before reading or applying the dump.
- A deliberate primary-database disaster recovery operation requires the additional exact acknowledgement `--allow-primary-restore RESTORE_PRIMARY_KNOWME`, in addition to the existing `--confirm RESTORE_KNOWME`.

Credentials and query parameters do not make two URLs different restore targets. Default PostgreSQL port 5432 and explicit `:5432` are treated as the same target.

## Safety boundaries

This guard is defense in depth, not infrastructure proof. It cannot prove that two DNS names do not resolve to the same cluster, that a proxy does not route both URLs to the same database, or that the operator selected the correct cloud project. Production recovery still requires infrastructure-level target verification, access control, maintenance mode, a current recoverable backup and a documented incident procedure.

The override is intentionally explicit because restoring into the primary database is destructive by design. It does not weaken manifest validation, SHA-256 verification, `--max-age-hours`, `pg_restore --exit-on-error`, or the existing restore confirmation.

## Tests

Unit coverage verifies:

- different database targets are accepted;
- the same host/database is rejected even with different users, credentials, protocol spelling, query parameters, host casing or implicit/explicit port 5432;
- an arbitrary override value is rejected;
- the exact `RESTORE_PRIMARY_KNOWME` acknowledgement permits a deliberate primary recovery.

The repository CI remains the merge gate: dependency audit, Prisma generation, migration deploy, zero drift, monorepo build, unit tests, Chromium Web E2E and PostgreSQL API E2E must pass on the exact PR head.

## Migration

No Prisma or data migration.

## Rollback

Revert KMD-213. This removes only the restore-target comparison/override requirement and leaves KMD-165/KMD-212 backup integrity behavior intact.

## External evidence still required

KMD-213 does not claim completion of any real backup schedule, encrypted off-site storage, replicated backup, restore drill, measured RPO/RTO, production maintenance window or disaster recovery exercise.
