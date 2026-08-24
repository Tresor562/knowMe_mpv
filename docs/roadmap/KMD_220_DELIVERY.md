# KMD-220 — Backup freshness readiness

## Goal

Turn the existing signed-backup lifecycle into an automatable readiness signal without pretending that KnowMe configures the production scheduler or remote storage itself.

KMD-216 signs backup manifests, KMD-218 validates artifacts before retention pruning, and KMD-219 requires an explicit retention policy for a market release. KMD-220 adds a read-only verification command that can detect when the available signed backups are too few, stale or corrupted.

## Changes

- adds `pnpm db:backup:verify`;
- reuses a shared fail-closed backup-directory inspection path for retention and readiness;
- validates dump/manifest pairing, regular-file boundaries, HMAC authenticity, manifest structure and SHA-256 before reporting readiness;
- requires at least `KNOWME_BACKUP_KEEP_MINIMUM` verified backups;
- requires the newest verified backup to be no older than `KNOWME_BACKUP_MAX_AGE_HOURS`;
- refuses a future-dated newest backup instead of treating negative age as healthy;
- adds `KNOWME_BACKUP_MAX_AGE_HOURS` to the market-release preflight with an explicit 1..8760-hour bound;
- keeps `.env.example` without an invented production value so operations must choose the objective from the approved RPO;
- adds root regression coverage for freshness, minimum-count and tamper failures.

## Operational usage

With the release environment loaded, verify the local/mounted backup directory:

```bash
pnpm db:backup:verify
```

An explicit directory or thresholds can be provided for an isolated drill:

```bash
pnpm db:backup:verify -- --directory /secure/backups --keep-minimum 3 --max-age-hours 24
```

A production scheduler/monitor may run this command after its backup job and alert on a non-zero exit status. That scheduler, alert transport and storage topology remain infrastructure responsibilities and are not created by this KMD.

## Safety and privacy boundaries

The verifier is read-only. It does not delete backups, trigger a backup, restore a database, expose database credentials or print backup contents. It reports only aggregate count and age information on success. Existing pruning still requires `PRUNE_KNOWME`; restore protections and destructive confirmations remain unchanged.

The verifier fails closed when it encounters an orphan dump/manifest, a symlink/non-regular artifact, an unauthentic manifest, a checksum mismatch, too few verified backups, a stale newest backup or a future-dated newest backup.

## Validation

Automated coverage verifies:

- sufficient authentic backups plus a fresh newest backup pass;
- fewer backups than the configured minimum fail;
- a newest backup older than the configured maximum age fails;
- payload tampering fails before readiness can be reported;
- a future-dated newest backup fails;
- release preflight requires a canonical bounded `KNOWME_BACKUP_MAX_AGE_HOURS`;
- existing KMD-218 retention tests continue to exercise the same shared inspection boundary.

The repository merge gate remains production dependency audit, Prisma generation, `migrate deploy`, zero drift, complete monorepo build, root unit tests, Chromium Web E2E and PostgreSQL API E2E on the exact PR head.

## Migration

No Prisma migration and no persisted application-data migration are required.

Before a market release, operations/release owners must choose `KNOWME_BACKUP_MAX_AGE_HOURS` from the approved recovery objective and configure the existing signing key, retention window and minimum retained count. After deployment, the verifier must be wired to the real backup schedule/monitoring system and exercised against the actual storage mount.

## Rollback

Revert KMD-220 to remove the freshness release requirement, the verification command and shared readiness helper. KMD-216 signed manifests, KMD-218 pruning and KMD-219 retention configuration remain independently usable. A rollback does not alter or delete existing backup artifacts.

## External evidence still required

KMD-220 does **not** prove:

- that production backups are scheduled or successfully copied off-host;
- that remote storage is encrypted, immutable or replicated;
- that alerts are connected to a real monitoring/on-call system;
- that the configured age/count targets satisfy an approved RPO/RTO;
- that restore drills succeed in the target infrastructure;
- that legal/privacy owners approved the retention values;
- that production deployment, physical-device validation or store publication is complete.

Those remain external release gates requiring real evidence.
