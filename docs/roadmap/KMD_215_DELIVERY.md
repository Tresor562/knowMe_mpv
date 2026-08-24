# KMD-215 — PostgreSQL CLI credential isolation

## Goal

Reduce operational secret exposure during backup and restore by ensuring database usernames/passwords embedded in PostgreSQL URLs are not copied into `pg_dump` or `pg_restore` command-line arguments.

## Changes

- `postgresCliConnection()` parses the validated PostgreSQL URL, removes URL credentials from the connection string passed on argv, and exposes them to libpq through `PGUSER` / `PGPASSWORD` in the child-process environment.
- `buildBackupArgs()` and `buildRestoreArgs()` now always emit credential-free PostgreSQL connection strings.
- backup and restore processes merge only the derived credential environment into their child environment.
- `sslpassword` in the URL query string is rejected because leaving it there would reintroduce a secret into argv.
- connection options such as `sslmode` remain on the credential-free connection URL.

## Security boundary

This change reduces exposure through process listings, command inspection and diagnostic tooling that records argv. Environment variables are still sensitive process state and must remain protected by the host/container runtime. This change does not claim host compromise resistance, secret-manager configuration, encrypted backup storage, remote replication, or a completed recovery drill.

URLs without embedded credentials continue to allow normal libpq environment/service-file authentication supplied by the runtime.

## Tests

`postgres-cli-secret-isolation.test.mjs` covers:

- percent-decoded username/password transfer to `PGUSER` / `PGPASSWORD`;
- absence of credentials from backup argv;
- absence of credentials from restore argv;
- rejection of `sslpassword` query-string leakage;
- preservation of credential-free URLs and libpq environment fallback behavior.

The repository merge gate remains production dependency audit, Prisma generation, `migrate deploy`, zero schema drift, monorepo build, unit tests, Chromium Web E2E and PostgreSQL API E2E on the exact PR head.

## Migration

No Prisma migration and no persisted application-data change.

## Rollback

Revert KMD-215 to restore the previous command construction. Doing so reintroduces the risk of credentials embedded in `DATABASE_URL` / `RESTORE_DATABASE_URL` appearing in PostgreSQL utility argv, so rollback should be limited to an emergency compatibility issue and followed by a forward fix.

## External evidence still required

- real production backup scheduling;
- encrypted/replicated backup storage;
- isolated restore drill;
- measured RPO/RTO;
- production secret-manager and host process-isolation validation.
