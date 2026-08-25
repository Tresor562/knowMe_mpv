# KMD-234 — Media scan attempt metadata

## Goal

Create the durable, queryable retry boundary required before any automatic quarantine rescan worker can be considered safe. KMD-234 does not schedule retries; it records enough authoritative state for a later block to enforce bounded backoff and attempt caps.

## Delivered boundary

- `MediaAsset.scannerAttemptCount` records how many scanner decisions have been attempted for the asset.
- `MediaAsset.scannerLastAttemptAt` records the timestamp of the latest scanner attempt when KnowMe can prove it.
- Newly completed uploads persist `scannerAttemptCount=1` and the initial attempt timestamp.
- KMD-233 manual rescans increment the attempt count atomically and update the latest-attempt timestamp regardless of `CLEAN`, `INFECTED`, or `UNAVAILABLE` result.
- Storage-integrity failures do not increment scanner attempts because no scanner request is made.
- Concurrent state changes remain fail-closed through KMD-233's conditional update.
- An index on `(status, scannerVerdict, scannerLastAttemptAt)` prepares bounded selection of future retry candidates without exposing this metadata publicly.

## Existing rows

The migration gives existing `MediaAsset` rows `scannerAttemptCount=1`, because every persisted media row already carries a scanner verdict from its original completion path. `scannerLastAttemptAt` is left `NULL` for historical rows because the exact original scan timestamp was not previously persisted and must not be invented.

## Tests

KMD-233 rescan unit tests now assert that successful, infected, and unavailable rescans increment the attempt count and update the latest-attempt timestamp. Existing integrity and concurrency tests continue to prove that blocked/non-applied operations do not overwrite state.

The repository CI remains authoritative for migration deploy, zero schema drift, build, root tests, Chromium Web E2E, and PostgreSQL API E2E.

## Migration and rollback

Migration: `20260825111500_kmd_234_media_scan_attempt_metadata` adds two columns and one index without rewriting application-visible semantics.

Rollback strategy:

1. stop any future worker that depends on these fields before schema rollback;
2. revert KMD-234 application code;
3. if a database rollback is explicitly required, drop `MediaAsset_status_scannerVerdict_scannerLastAttemptAt_idx`, then drop `scannerLastAttemptAt` and `scannerAttemptCount`.

Dropping these fields loses retry telemetry only; it does not change media ownership, quarantine status, scanner verdicts, or stored content.

## Proof limits

KMD-234 does not claim that automatic retries, backoff, provider capacity, scanner deployment, production credentials, alerting, SLA, real EICAR/benign exercises, or analyst workflows are validated. The KMD-228 market blocker remains in force.
