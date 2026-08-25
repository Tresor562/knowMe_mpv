# KMD-233 — Controlled media quarantine rescan

## Goal

Provide an auditable, fail-closed way for authorized KnowMe operators to re-submit media that is quarantined **only because the external scanner was unavailable**. This does not weaken the production scanner release blocker or create an automatic retry loop.

## Delivered boundary

- Adds dedicated `media.quarantine.manage` permission. Owner and administrator roles inherit it through the canonical permission catalog; read-only/support roles do not.
- Adds `POST /admin/operations/media-quarantine/:id/rescan` behind JWT + `media.quarantine.manage`.
- Only assets with `status=QUARANTINED`, `scannerVerdict=UNAVAILABLE`, and `deletedAt=null` are eligible.
- `INFECTED`, `AVAILABLE`, deleted, pending/unknown, or missing assets are never re-submitted by this operation.
- Stored bytes are loaded from private media storage and their SHA-256 must still equal the persisted upload hash before any external scan is attempted.
- A `CLEAN` verdict is the only result that can move the asset to `AVAILABLE`.
- `INFECTED` and `UNAVAILABLE` results remain `QUARANTINED`.
- The state transition uses a conditional `updateMany` guard so a concurrent moderation/deletion/state change is not overwritten.
- Successful attempts and storage-integrity blocks are audit logged without scanner credentials, file contents, hashes, filenames, storage keys, or provider response bodies.
- The response is deliberately minimal: asset id, resulting status, and resulting scanner verdict. Scanner references remain server-side.

## Tests

- Unit coverage proves clean release, infected fail-closed behavior, scanner outage behavior, ineligible-asset refusal, storage-integrity refusal, audit behavior, and concurrent-state refusal.
- PostgreSQL E2E extends the existing media-quarantine operations coverage with 401/403 checks for the write endpoint and proves an infected quarantined asset cannot be re-scanned through this endpoint.
- Existing CI remains authoritative for build, unit tests, Chromium Web E2E, migrations/drift, and API E2E PostgreSQL.

## Migration

No Prisma schema or persistent-data migration is required. Access-control catalog initialization will create/synchronize the new permission and attach it to canonical owner/administrator roles through the existing catalog mechanism.

Operationally, deploy the API normally. Do not automate retries until a later block defines bounded retry scheduling, backoff, concurrency, observability, and provider-capacity policy.

## Rollback

Revert KMD-233. The endpoint and dedicated permission disappear. Existing media state remains valid: assets already released after a verified `CLEAN` result stay `AVAILABLE`; quarantined assets stay quarantined. No destructive data rollback is required.

## Proof limits

KMD-233 does **not** prove or claim:

- that a production antimalware provider is deployed, reachable, correctly credentialed, or covered by an SLA;
- that DNS/TLS, egress controls, secret-manager integration, provider capacity, or alerting have been validated in production;
- that rescan is scheduled automatically;
- that infected media has been reviewed or deleted by a human analyst;
- that real benign/EICAR/provider-outage exercises have been completed in production.

The KMD-228 market blocker therefore remains in force until those external proofs are actually available.
