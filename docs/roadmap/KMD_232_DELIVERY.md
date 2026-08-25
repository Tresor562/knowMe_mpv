# KMD-232 — Media quarantine operational readiness

## Goal

Turn the aggregate quarantine telemetry introduced by KMD-231 into a bounded operational state that can be consumed by administrators without exposing media, users, scanner secrets, or provider internals.

## Changes

`GET /admin/operations/media-quarantine` now includes a deterministic `readiness` field in addition to the existing aggregate counters and oldest quarantine timestamp.

Readiness is fail-closed and ordered conservatively:

1. `BLOCKED_INFECTED` when at least one non-deleted quarantined asset is marked `INFECTED`.
2. `BLOCKED_SCANNER_UNAVAILABLE` when no infected asset is present but at least one quarantined asset is marked `UNAVAILABLE`.
3. `PENDING_QUARANTINE` when quarantine is non-empty for another verdict such as `PENDING`.
4. `CLEAR` only when there are no non-deleted quarantined assets.

The existing counts remain in the response so the single readiness value never hides simultaneous conditions. For example, an infected asset takes precedence in `readiness`, while the `unavailable` count remains visible.

## Privacy and authority boundary

This endpoint remains protected by JWT plus `audit.read` and remains aggregate-only. It does not expose filenames, media bytes, storage keys, hashes, account IDs, conversation IDs, scanner references, scanner endpoints, bearer tokens, provider responses, or provider error details.

KMD-232 does not add clean overrides, release-from-quarantine operations, delete operations, analyst content access, or any other consequential media action.

## Release boundary

The KMD-228 market-release scanner blocker remains unchanged. `CLEAR` means only that the current database has no non-deleted quarantined media at the instant of the snapshot. It is not evidence that a real production scanner provider, network route, credentials, SLA, signatures, alerting, or target-environment behavior has been validated.

## Tests

Coverage includes:

- precedence of infected media over other conditions;
- scanner-unavailable state;
- pending-quarantine state;
- clear empty state;
- aggregate snapshot response;
- PostgreSQL E2E authorization and exact response shape.

## Migration

No Prisma migration and no user-data migration are required. This is an additive response-field change on an administrator-only operations endpoint.

## Rollback

Revert KMD-232. The KMD-231 aggregate endpoint remains available without the derived `readiness` field.

## External proof still required

KMD-232 does not prove or claim:

- a real malware-scanning provider in production;
- production scanner credentials or secret-manager configuration;
- DNS/TLS ownership or egress policy;
- alert delivery to an on-call system;
- provider SLA, detection quality, supported formats or signature freshness;
- production throughput/load behavior;
- analyst quarantine workflows;
- physical mobile upload behavior;
- production deployment or store publication.

## Merge gate

Merge only after the exact PR head passes dependency audit, Prisma generation, migration deploy, zero drift, full monorepo build, root tests, Chromium Web E2E and PostgreSQL API E2E.
