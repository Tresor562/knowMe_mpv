# KMD-248 — Media purge alert delivery observability

## Goal

Make the KMD-246 media purge incident alert worker operationally observable without exposing webhook configuration, secrets, media metadata, user data, or provider response bodies.

## Delivered

- Adds an in-memory operational snapshot to `MediaPurgeAlertWorkerService`.
- Tracks the last poll, alert attempt, successful delivery, failure, observed purge readiness, and bounded last result.
- Preserves the existing five-minute poll cadence and one-hour reminder/deduplication cadence.
- Adds `GET /admin/operations/media-quarantine-alert` behind JWT + `audit.read`.
- Keeps the endpoint read-only; it cannot trigger an alert, purge, rescan, or configuration change.
- Adds unit coverage for clear, delivered, deduplicated, and failed/retried states.
- Adds PostgreSQL E2E coverage for 401/403/200 access and the privacy-bounded response shape.

## Privacy and security boundary

The snapshot intentionally contains only process-local operational timestamps and bounded state names. It does not expose:

- webhook URL or bearer token;
- scanner URL/token;
- media IDs, filenames, hashes, storage keys, or contents;
- user IDs, e-mail addresses, conversation IDs, or ownership metadata;
- provider response bodies or network error details.

`audit.read` remains required for access.

## Migration

No Prisma migration is required. The telemetry is process-local and starts empty after every process restart.

## Rollback

Revert KMD-248. KMD-245/246 alert delivery continues to function; only the new operational snapshot and admin endpoint disappear.

## Validation required before merge

The exact PR head must pass the repository CI gate: dependency audit, Prisma generation, migration deploy, drift check, monorepo build, root tests, Chromium Web E2E, and PostgreSQL API E2E.

## External proof still required

KMD-248 does not prove webhook-provider ownership or SLA, DNS/TLS/egress, secret-manager injection, real on-call delivery/escalation, distributed alert state across multiple API instances, antimalware-provider production readiness, legal approval, production deployment, physical mobile validation, or store publication.
