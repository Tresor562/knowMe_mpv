# KMD-240 — Media quarantine retention enforcement

## Goal

Turn the explicit KMD-239 quarantine retention policy into bounded physical enforcement without weakening the malware quarantine boundary.

## Delivered

- Automatic in-process sweep every five minutes when both quarantine retention values are configured.
- Production startup fails closed if the retention policy is incomplete or invalid.
- Only `QUARANTINED`/`PURGING` assets with `INFECTED` or `UNAVAILABLE` scanner verdicts are eligible.
- Separate retention cutoffs are honored for infected and scanner-unavailable media.
- Batch size is bounded to 25 assets per sweep.
- A row is atomically claimed by changing `QUARANTINED` to `PURGING` before object bytes are deleted.
- If the claim loses a race, storage deletion is skipped.
- `PURGING` rows are resumable, so a process crash between claim, storage deletion and metadata deletion does not permanently orphan the cleanup workflow.
- Private storage deletion is idempotent for missing objects.
- The system audit records the object-deletion event without logging file bytes, hashes, storage credentials or scanner secrets.
- Metadata is removed only after the storage deletion and audit step complete.

## Safety boundaries

KMD-240 does not make quarantined media available. It does not change scanner verdicts, scanner retries, upload access control, or the KMD-228 release blocker.

The release remains blocked until the real production malware scanner, credentials/secret manager, DNS/TLS/egress, capacity/SLA, alerting and target-environment benign/EICAR failure scenarios are proven.

The current market topology is still constrained to one API instance by the existing rate-limit topology gates. Before horizontal API scaling, this in-process worker requires a distributed claim/lease design.

## Data migration

No Prisma migration is required. `MediaAsset.status` is a string field and `PURGING` is an internal transient lifecycle value. Existing KMD-239 retention variables are reused.

## Rollback

Revert KMD-240. Existing `QUARANTINED` media remains inaccessible and KMD-239 continues to enforce explicit retention configuration at release preflight, but physical expiry enforcement stops until another approved cleanup mechanism is deployed.

## Validation

Required before merge:

- dependency audit;
- Prisma generation and migration deploy;
- zero schema drift;
- monorepo build;
- root tests including KMD-240 unit coverage;
- Chromium Web E2E;
- API E2E on PostgreSQL.

No production deletion, production object-storage exercise, legal retention approval, mobile physical test, deployment or store publication is claimed by this milestone.
