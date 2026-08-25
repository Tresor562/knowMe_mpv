# KMD-235 — Media quarantine retry policy

## Goal

Define the deterministic, fail-closed eligibility and backoff rules required before any automatic media-quarantine retry worker can be enabled. KMD-235 deliberately does not schedule or execute background retries.

## Delivered boundary

- only `QUARANTINED` media with `scannerVerdict=UNAVAILABLE` can ever be eligible;
- deleted media, infected media, clean media and available media are never eligible;
- retry attempts are capped at 5 total scanner attempts;
- retry delay uses bounded exponential backoff starting at 5 minutes and capped at 6 hours;
- retry eligibility requires an authoritative `scannerLastAttemptAt` timestamp;
- historical rows with an unknown last-attempt time remain ineligible rather than being bulk retried on an invented timestamp;
- future timestamps, invalid counters and malformed state fail closed.

## Tests

Unit coverage proves the exact boundary, backoff schedule, attempt cap, legacy-null behavior and fail-closed handling of invalid/future state. Repository CI remains authoritative for build, Prisma/migrations, root tests, Chromium E2E and PostgreSQL API E2E.

## Migration and rollback

No Prisma migration is required. KMD-235 consumes the durable attempt metadata introduced by KMD-234.

Rollback: revert the KMD-235 policy and tests. Because no worker is enabled by this block, rollback has no queue, schedule or persisted retry state to drain.

## Proof limits

KMD-235 does not claim that automatic retries, a scheduler, distributed locking, provider capacity, production scanner deployment, credentials, alerting, SLA, real EICAR/benign exercises or analyst workflows are validated. The KMD-228 market blocker remains in force.
