# KMD-246 — Media purge alert delivery worker

## Goal

Wire the privacy-minimized KMD-245 webhook adapter into the existing media quarantine retention readiness signal without creating alert spam or weakening retention behavior.

## Delivered

- Polls the existing retention operational snapshot every five minutes.
- Sends alerts only for `BLOCKED_WORKER`, `BLOCKED_MAX_BACKOFF`, and `ACTION_REQUIRED`.
- Sends immediately when the blocking readiness changes.
- Deduplicates an unchanged blocking state for one hour, then permits a reminder.
- Failed deliveries are not marked delivered, so the next poll may retry.
- Clearing/non-alertable states reset the in-process delivery window.
- Payload remains aggregate-only and uses the KMD-245 HTTPS adapter.

## Privacy and safety boundaries

No media identifiers, account identifiers, filenames, storage keys, hashes, file contents, scanner secrets, webhook credentials, or raw provider responses are added to the alert payload.

The worker does not delete, rescan, release, or mutate media. It only observes existing retention readiness and attempts an external notification.

## Operational boundary

Deduplication state is process-local. The current release topology is already constrained to one API instance by the existing rate-limit topology guard. A future multi-instance deployment must add distributed alert deduplication before relying on this worker at scale.

This code does not prove that a production webhook provider, DNS/TLS path, egress policy, secret manager, on-call route, escalation policy, or external delivery works in the target infrastructure.

## Migration

No Prisma migration is required. Deploying the code activates the worker; without valid KMD-245 webhook configuration, delivery remains skipped by the adapter.

## Rollback

Revert KMD-246. The KMD-245 adapter and all KMD-240–244 retention/readiness behavior remain intact; only automatic alert attempts stop.

## Validation

Repository CI must pass dependency audit, Prisma generation/migrations/drift checks, build, unit tests, Chromium E2E, and PostgreSQL API E2E on the exact PR head before merge.
