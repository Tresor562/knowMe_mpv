# KMD-283 — PostgreSQL restore drill evidence

## Goal

Turn KnowMe's existing guarded PostgreSQL restore tooling into a repeatable isolated recovery drill that can produce a bounded evidence artifact for the market-readiness `backup_restore_drill` proof slot.

## Delivered behavior

A new command is available:

```bash
pnpm db:restore:drill -- --file /secure/knowme.dump --output /secure/knowme-restore-drill.json --max-age-hours 24 --confirm RESTORE_DRILL_KNOWME
```

The drill deliberately reuses the existing signed-backup and restore protections rather than creating a second restore path.

Before any destructive restore work begins, it:

- requires the explicit drill confirmation `RESTORE_DRILL_KNOWME`;
- requires a canonical positive backup-age policy between 1 and 8760 hours;
- validates the selected `.dump` and signed backup manifest;
- verifies the manifest HMAC and the dump SHA-256;
- requires `RESTORE_DATABASE_URL` to be different from `DATABASE_URL` with no primary-target override;
- reserves the evidence output with exclusive creation so an existing artifact can never be overwritten.

The drill then invokes the existing `postgres-restore.mjs` path with its own destructive confirmation and freshness policy. Once restore succeeds, it invokes `psql` against the isolated restore target using credentials through libpq environment variables rather than command-line arguments.

The bounded integrity query requires all of the following:

- the restored database is reachable;
- `public._prisma_migrations` exists;
- at least one table exists in the `public` schema.

Only when both the restore and the integrity query pass is an evidence JSON written. The artifact records the signed backup filename, backup SHA-256, backup creation time, manifest schema version, observation time, configured maximum backup age, and aggregate integrity results. It intentionally omits database URLs, usernames, passwords, hostnames, raw query output, and business/user data.

The resulting artifact SHA-256 is printed so the exact retained bytes can be converted into the existing `backup_restore_drill` market-evidence item using the already merged release-evidence tooling.

If restore or integrity validation fails after the evidence path was reserved, the partial reserved artifact is removed. If the destination already exists, the drill refuses to start any destructive restore command.

## Tests

The root `pnpm test` suite now includes `scripts/postgres-restore-drill.test.mjs`, covering:

- canonical max-age policy and exact confirmation;
- successful integrity-output parsing;
- rejection of missing migrations or an empty public schema;
- isolated-target enforcement before destructive work;
- PostgreSQL credentials excluded from `psql` argv;
- successful bounded evidence generation without secrets;
- exclusive output reservation before restore;
- cleanup when the restore/integrity phase fails.

The full repository CI remains authoritative for build, unit, migrations/drift, Chromium Web E2E, and API E2E.

## Migration

No Prisma or user-data migration is required.

Operational prerequisites for a real drill are:

- PostgreSQL client tools (`pg_restore` and `psql`) installed in the drill environment;
- a real signed KnowMe backup artifact and manifest;
- `KNOWME_BACKUP_MANIFEST_SIGNING_KEY` supplied securely;
- an isolated `RESTORE_DATABASE_URL` that is not the production `DATABASE_URL`;
- sufficient storage and database permissions for restore;
- a retained output location for the evidence artifact.

## Rollback

Revert KMD-283. Existing `pnpm db:restore` behavior remains unchanged; operators can still perform guarded manual restores but will lose the dedicated isolated drill/evidence workflow.

## Proof boundary

KMD-283 provides the software path required to execute and record an isolated restore drill. Unit/CI tests use simulated child-process outcomes and do not constitute a real restore proof. The market evidence must remain `PENDING` until the command is executed against an actual retained backup and isolated PostgreSQL target, the produced artifact is preserved, hashed, reviewed, and bound into the signed release-evidence bundle.

A passing drill proves only that the selected backup restored into that isolated target and passed the bounded schema checks during that run. It does not by itself prove remote backup durability, full business-data correctness, production failover, storage replication, or achieved RPO/RTO under a real outage.
