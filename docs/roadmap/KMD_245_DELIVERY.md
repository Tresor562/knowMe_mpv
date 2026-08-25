# KMD-245 — Media purge incident webhook adapter

## Goal

Add a narrow, privacy-minimized HTTPS adapter that can notify an external operations system when media-quarantine purge readiness reaches a blocking state, without claiming that a production alert destination has been configured or validated.

## Delivered

- `MediaPurgeAlertService` accepts only the aggregate KMD-244 purge-readiness contract.
- Only `BLOCKED_WORKER`, `BLOCKED_MAX_BACKOFF`, and `ACTION_REQUIRED` are alertable. Non-blocking states do not create outbound traffic.
- The payload is bounded to readiness, observation time, and aggregate backlog counts/timestamps. It contains no media ID, account ID, filename, storage key, hash, e-mail, scanner secret, scanner response, or object contents.
- Delivery uses a server-only bearer token and HTTPS endpoint.
- Unsafe endpoints containing HTTP, credentials, query strings, or fragments are rejected.
- The token must contain at least 32 characters.
- Timeout is canonical and bounded to 500..10000 ms.
- Provider HTTP failures, network failures, timeouts, and oversized responses fail closed as `FAILED` without exposing provider response bodies.
- The adapter is registered in `AdminModule` for the next integration block.

## Configuration

Server-only variables:

- `MEDIA_PURGE_ALERT_WEBHOOK_URL`
- `MEDIA_PURGE_ALERT_WEBHOOK_TOKEN`
- `MEDIA_PURGE_ALERT_WEBHOOK_TIMEOUT_MS`

KMD-245 deliberately does not make these variables mandatory for release yet because the adapter is not wired to the retention worker in this block.

## Validation

Unit coverage verifies:

- no outbound request for non-alertable states;
- no outbound request when configuration is missing or unsafe;
- exact bounded aggregate payload;
- HTTPS/token/timeout validation;
- fail-closed handling of provider and network failures.

The exact branch head must pass the repository CI gate before merge.

## Migration

No Prisma migration and no user-data migration are required.

## Rollback

Remove `MediaPurgeAlertService`, its tests, documentation, and provider registration from `AdminModule`. Existing KMD-244 admin readiness remains unchanged.

## Proof boundaries

KMD-245 does **not** prove:

- that an external alerting provider has been provisioned;
- that webhook credentials exist in a production secret manager;
- that DNS/TLS/egress/firewall policy is correct;
- that an on-call destination receives or acknowledges alerts;
- that alerts are deduplicated across process restarts or multiple API instances;
- that escalation, paging, SLOs, or incident response have been exercised.

Those require real target-environment evidence. The next integration block may wire bounded state transitions to this adapter, but must preserve these proof boundaries.
