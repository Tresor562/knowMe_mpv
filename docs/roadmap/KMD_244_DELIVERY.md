# KMD-244 — Media quarantine purge readiness

## Goal

Turn KMD-243's aggregate purge backlog telemetry into a deterministic operator-facing readiness signal without changing destructive retention behavior.

## Delivered

`GET /admin/operations/media-quarantine-retention` now includes `purgeReadiness` with these bounded states:

- `DISABLED`: retention is not configured outside production.
- `BLOCKED_WORKER`: the retention worker is failing or stale.
- `BLOCKED_MAX_BACKOFF`: at least one purge retry has reached the 24-hour backoff cap.
- `ACTION_REQUIRED`: expired quarantined media or due retries require immediate worker progress.
- `AWAITING_FIRST_RUN`: retention is configured but the worker has not completed its first attempt.
- `RETRY_SCHEDULED`: no work is due now, but at least one retry is scheduled.
- `CLEAR`: worker state and persisted backlog expose no current retention work.

The classification is pure, read-only, and prioritizes worker failure and maximum-backoff retries over lower-severity backlog states.

## Privacy and authority boundaries

The endpoint remains protected by JWT + `audit.read`. No media ID, user ID, filename, hash, storage key, scanner secret, provider response, or audit-log content is added. KMD-244 does not trigger purge, rescan, retry, deletion, or configuration changes.

## Tests

- unit coverage for every readiness state and priority;
- existing retention E2E contract extended with the new bounded field;
- repository CI remains the merge gate.

## Migration

No Prisma migration is required. This change derives readiness from already persisted KMD-242/KMD-243 state.

## Rollback

Revert KMD-244. KMD-243 backlog telemetry and KMD-242 purge behavior remain intact.

## Proof limits

`CLEAR` is not proof of legal retention approval, object-store deletion in production, external alert delivery, distributed locking, scanner-provider readiness, deployment, physical mobile validation, or store publication.
