# KMD-216 — Backup manifest authenticity

## Goal

Harden PostgreSQL recovery so a locally consistent dump plus SHA-256 manifest is not automatically trusted when both artifacts could have been replaced together.

## Changes

- new backup manifests use schema version 2;
- manifests are authenticated with HMAC-SHA-256 using `KNOWME_BACKUP_MANIFEST_SIGNING_KEY`;
- the signing key is mandatory for new backups and must contain at least 32 characters;
- restore verifies manifest authenticity before invoking `pg_restore`;
- signature comparison uses `timingSafeEqual`;
- the signing key is never persisted in the dump or manifest and is not passed through command-line arguments;
- unsigned schema-v1 historical backups fail closed by default;
- a trusted historical schema-v1 backup can only be restored with the explicit `--allow-unsigned-legacy RESTORE_UNSIGNED_KNOWME` override in addition to the normal destructive restore confirmation;
- root `pnpm test` now executes the PostgreSQL CLI credential-isolation suite from KMD-215 and the new manifest-authenticity suite, closing a CI coverage gap where the KMD-215 test file existed but was not part of the root test command.

## Security boundary

HMAC authenticity detects manifest modification without the signing key. It does not encrypt the backup, prevent deletion, protect a compromised host that can read the signing key, configure a production secret manager, provide immutable storage, or prove remote replication.

`KNOWME_BACKUP_MANIFEST_SIGNING_KEY` must be independently generated and kept separate from JWT, payments, recovery, media, TURN, Nexus and sticker secrets. Backup artifacts still contain sensitive user data and require encrypted, access-controlled storage.

## Compatibility and migration

No Prisma migration and no application-data schema change are required.

Operational migration:

1. generate a dedicated random signing secret of at least 32 characters;
2. store it in the production secret manager as `KNOWME_BACKUP_MANIFEST_SIGNING_KEY`;
3. deploy KMD-216 before creating the next backup;
4. preserve the signing secret for as long as any signed backup that may need restoration is retained;
5. treat key rotation as a recovery-policy change: keep the prior key securely available until all backups signed with it age out or are superseded by verified backups under the new key.

KMD-216 deliberately does not implement multi-key rotation inside the manifest because key identifiers and rotation policy should be introduced as a separate bounded change rather than silently weakening verification.

## Tests

Automated tests cover:

- minimum signing-key length;
- successful HMAC verification;
- rejection after manifest SHA/file tampering;
- rejection with a different signing key;
- rejection of unsupported signature metadata;
- fail-closed unsigned legacy behavior;
- explicit legacy override behavior;
- schema-v2 manifest structure and absence of signing-key material;
- KMD-215 PostgreSQL argv credential-isolation tests are now wired into root `pnpm test`.

The repository merge gate remains production dependency audit, Prisma generation, `migrate deploy`, zero drift, monorepo build, unit tests, Chromium Web E2E and PostgreSQL API E2E on the exact PR head.

## Rollback

Reverting KMD-216 returns new backups to unsigned schema-v1 manifests and removes authenticity verification. Existing schema-v2 signed manifests would no longer be understood by the older restore tooling, so rollback during an incident must preserve the KMD-216 restore script or use a trusted forward fix rather than discarding signed recovery metadata.

## External evidence still required

- production secret-manager configuration and access policy;
- encrypted/immutable or access-controlled remote backup storage;
- scheduled backup execution and retention policy;
- remote replication;
- isolated restore drill using a real retained backup;
- measured RPO/RTO;
- tested signing-key rotation/recovery procedure;
- production deployment approval and legal/privacy review where applicable.
