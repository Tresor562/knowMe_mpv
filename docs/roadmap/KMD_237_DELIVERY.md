# KMD-237 — Media quarantine retry observability

## Goal

Make the KMD-236 automatic quarantine retry worker observable to operators without exposing media contents, asset identifiers, users, scanner secrets, provider responses or storage keys.

## Delivered

- Adds an in-process worker snapshot with bounded operational fields only.
- Exposes `GET /admin/operations/media-quarantine-retry` behind the existing JWT + `audit.read` boundary.
- Reports `DISABLED`, `AWAITING_FIRST_RUN`, `HEALTHY`, `FAILING` or `STALE` readiness.
- Reports configured interval/batch size plus the last bounded batch counters.
- Records last attempt, success and failure timestamps in process memory.
- Logs whole-batch failures without exposing secrets or media payloads.

## Privacy and security boundary

The endpoint does not expose media IDs, owner IDs, file names, hashes, storage keys, scanner credentials, scanner URLs or provider response bodies. The status is operational telemetry only and cannot trigger a retry or modify configuration.

## Migration

No Prisma migration is required. Deploy the API normally. Existing environments remain `DISABLED` unless `MEDIA_QUARANTINE_RETRY_ENABLED=true` is explicitly configured.

## Rollback

Revert KMD-237. KMD-236 automatic retry behavior remains unchanged; only the additional in-process status tracking and admin read endpoint are removed.

## Release boundary

This does not remove the KMD-228 market blocker. A real production malware-scanning provider, credentials/secret management, egress policy, capacity/SLA, alerting, real benign/EICAR exercises and analyst procedures still require external proof. The snapshot is process-local and is not evidence of distributed worker health.
