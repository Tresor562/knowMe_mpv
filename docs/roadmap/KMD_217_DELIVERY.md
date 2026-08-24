# KMD-217 — Backup authenticity release preflight

## Goal

Ensure a market-release preflight cannot pass while the KMD-216 PostgreSQL backup-authenticity key is missing, weak, or reused across another production trust boundary.

## Changes

- adds `scripts/backup-release-preflight.mjs`;
- requires `KNOWME_BACKUP_MANIFEST_SIGNING_KEY` to be configured with at least 32 characters;
- rejects exact secret reuse with JWT, metrics, media storage, stickers, account recovery, recovery e-mail, TURN, Nexus and payment security secrets when those values are configured;
- reports only environment-variable names on isolation failures, never secret values;
- wires the backup preflight into root `pnpm check:release` after the existing API/Web and Mobile production preflights;
- wires `backup-release-preflight.test.mjs` into root `pnpm test`.

## Release semantics

A green repository preflight proves only that the required backup-authenticity configuration is present and separated from the checked trust boundaries. It does not prove that the configured value lives in a real production secret manager, that access control is minimal, that backups are scheduled, or that restoration succeeds in the target infrastructure.

The preflight intentionally does not generate a signing key. Production secrets must be generated and provisioned by the deployment environment rather than written into source control or generated implicitly during application startup.

## Tests

Automated coverage verifies:

- a dedicated signing key passes;
- a missing signing key blocks release;
- a signing key shorter than 32 characters blocks release;
- reuse of JWT or account-recovery secrets blocks release;
- validation errors do not disclose the reused secret value.

The repository merge gate remains:

1. production dependency audit;
2. Prisma generation;
3. `prisma migrate deploy` against PostgreSQL 16;
4. zero committed-migration/datamodel drift;
5. complete monorepo build;
6. complete root unit test command, including KMD-215/KMD-216/KMD-217 operational-security suites;
7. Chromium Web E2E;
8. PostgreSQL API E2E.

## Migration

No Prisma migration and no persisted application-data change are required.

Operationally, any environment intended to satisfy `pnpm check:release` after KMD-217 must provide a dedicated `KNOWME_BACKUP_MANIFEST_SIGNING_KEY` compatible with KMD-216.

## Rollback

Reverting KMD-217 removes the release-preflight requirement but does not remove KMD-216 signed backups. Such a rollback would allow a release configuration to pass without the key required to create/verify signed backups, so rollback should be limited to diagnosing a preflight defect and followed by a forward fix.

## External evidence still required

- production secret-manager configuration and IAM/access policy;
- tested key retention and rotation procedure;
- scheduled PostgreSQL backups;
- encrypted/access-controlled and preferably immutable or replicated remote storage;
- isolated restore drill using a retained signed backup;
- measured RPO/RTO;
- production deployment validation;
- legal/privacy review where required;
- physical-device and store-release evidence remain separate release gates.
