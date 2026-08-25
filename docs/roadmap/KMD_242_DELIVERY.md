# KMD-242 — Media quarantine purge retry backoff

## Goal

Prevent a failing object-store deletion from being hammered every five-minute retention sweep while preserving the legal/operational requirement to keep retrying an expired quarantine purge until it succeeds.

## Delivered

- Persist `retentionPurgeAttemptCount`, `retentionPurgeLastAttemptAt` and `retentionPurgeNextAttemptAt` on `MediaAsset`.
- Add an index for `PURGING` retry selection.
- Claim both first-time `QUARANTINED` purges and due `PURGING` retries atomically before deleting object bytes.
- Reserve the next retry before the destructive storage call so a crash or object-store failure cannot immediately re-hammer the same object.
- Use exponential backoff starting at 5 minutes and capped at 24 hours.
- Keep retries unbounded in count: KMD-242 does not silently abandon deletion obligations after an arbitrary number of failures.
- Preserve idempotent storage deletion and existing aggregate worker observability.

## Migration

Migration `20260825190500_kmd_242_media_quarantine_purge_backoff` adds nullable retry timestamps plus a zero-default attempt counter. Existing rows remain eligible: historical `PURGING` rows have `retentionPurgeNextAttemptAt = NULL` and can be reclaimed once, after which the worker persists their retry schedule.

## Rollback

Revert the KMD-242 application changes first so no runtime depends on the new columns. The added columns/index may then be removed in a separately reviewed rollback migration if operationally required. Do not drop retry metadata while a newer worker is running.

## Evidence boundaries

This block does not prove object-store availability, production deletion latency, approved legal retention periods, multi-instance distributed locking, provider SLA, external alert delivery, production deployment, physical mobile behavior or store publication. The KMD-228 malware-provider market blocker remains unchanged.
