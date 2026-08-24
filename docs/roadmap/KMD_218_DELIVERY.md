# KMD-218 — Safe PostgreSQL backup retention pruning

## Goal

Add a repository-visible retention command that can remove expired local PostgreSQL backup artifacts without turning backup cleanup into an unsafe destructive operation.

KMD-212 through KMD-217 established manifest validation, restore isolation, artifact lifecycle protection, credential isolation, signed manifests and a release preflight for the signing key. KMD-218 builds on those merged boundaries and does not weaken them.

## Changes

- adds `scripts/postgres-backup-retention-lib.mjs`;
- adds `scripts/postgres-backup-prune.mjs` and `pnpm db:backup:prune`;
- defaults to a dry run and requires the exact destructive confirmation `--confirm PRUNE_KNOWME` before deletion;
- supports a positive retention window through `--retention-days` / `KNOWME_BACKUP_RETENTION_DAYS`;
- always preserves at least a positive minimum number of newest backups through `--keep-minimum` / `KNOWME_BACKUP_KEEP_MINIMUM`;
- requires every considered dump to have a matching signed manifest and every manifest to have a matching dump;
- verifies signed-manifest authenticity, schema/path coherence and the dump SHA-256 before calculating any deletion plan;
- refuses symbolic-link or non-regular-file backup artifacts instead of following them;
- deletes only the exact dump/manifest pairs present in the validated plan;
- wires regression coverage into root `pnpm test`.

## Usage

Dry run with the default 30-day window and minimum of three retained backups:

```bash
pnpm db:backup:prune
```

Custom policy, still dry-run:

```bash
pnpm db:backup:prune -- --directory /secure/backups --retention-days 45 --keep-minimum 5
```

Apply the already validated policy deliberately:

```bash
pnpm db:backup:prune -- --directory /secure/backups --retention-days 45 --keep-minimum 5 --confirm PRUNE_KNOWME
```

The environment must provide the same `KNOWME_BACKUP_MANIFEST_SIGNING_KEY` trust boundary used to create the signed manifests.

## Fail-closed semantics

Pruning aborts before any deletion when it encounters an orphan dump, orphan manifest, unreadable/invalid manifest, unauthentic signed manifest, checksum mismatch, invalid retention value, invalid clock, symbolic link or non-regular backup artifact.

This intentionally favors operator intervention over silently deleting ambiguous data.

## Tests

Automated coverage verifies:

- backups inside the retention window remain untouched;
- backups older than the retention window are eligible only after the minimum newest count is preserved;
- the minimum count is preserved even when every backup is old;
- a modified dump fails checksum verification before deletion;
- a modified signed manifest fails authenticity verification;
- a missing manifest fails closed;
- deletion requires the exact destructive confirmation;
- confirmed deletion removes the planned dump and its manifest pair.

The normal repository merge gate remains the production dependency audit, Prisma generation, `migrate deploy`, zero drift, full build, root unit tests, Chromium Web E2E and PostgreSQL API E2E.

## Migration

No Prisma migration and no persisted application-data migration are required.

Operational adoption should choose a retention period and minimum count that satisfy the actual production RPO, legal/privacy retention policy and remote-storage design. KMD-218 does not choose those business values for production.

## Rollback

Revert KMD-218 to remove the pruning command and its tests. Already deleted local backup pairs cannot be recreated by code rollback; recovery then depends on whatever retained or replicated backups actually exist outside this command.

## External evidence still required

KMD-218 does **not** prove any of the following:

- that backups are scheduled in production;
- that remote backup storage exists;
- that storage is encrypted, immutable or replicated;
- that the chosen retention window is legally approved;
- that RPO/RTO targets are met;
- that a retained backup has been restored successfully in the target infrastructure;
- that production deployment, physical mobile validation or store publication has been completed.

Those remain release/operations gates requiring real evidence.
