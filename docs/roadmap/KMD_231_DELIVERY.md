# KMD-231 — Media quarantine operations visibility

## Goal

Give production operators a bounded, permission-gated view of the media quarantine backlog without exposing uploaded content, storage keys, account identifiers or scanner secrets.

## Changes

- Adds `MediaQuarantineOpsService` backed by aggregate PostgreSQL queries.
- Adds `GET /admin/operations/media-quarantine` protected by JWT plus the existing `audit.read` permission.
- Returns only four operational fields: total quarantined assets, quarantined `INFECTED` assets, quarantined `UNAVAILABLE` assets, and the creation timestamp of the oldest non-deleted quarantined asset.
- Does not expose filenames, MIME types, hashes, scanner references, storage locations, account IDs, conversation IDs or file contents.
- Adds unit coverage for aggregate behavior and PostgreSQL E2E coverage for 401/403/200 access boundaries and the exact response shape.

## Why this is required for launch

KMD-228 through KMD-230 make production media scanning fail closed and wire a provider-neutral external scanner into the authoritative upload path. A fail-closed scanner can legitimately create a quarantine backlog during malware detections or provider/network failures. Operations need to detect that backlog before users experience silent, indefinite media unavailability.

This milestone provides visibility only. It does not create an analyst download path, a manual clean override, or a destructive quarantine action.

## Privacy and security boundary

The endpoint is administrative and aggregate-only. It intentionally avoids per-asset data so ordinary operations monitoring cannot become a second content-browsing surface.

No scanner bearer token, endpoint, provider response body, file hash or uploaded bytes are returned or logged by this feature.

## Migration

No Prisma migration and no persisted-user-data migration are required. The feature reads the existing `MediaAsset.status`, `scannerVerdict`, `deletedAt` and `createdAt` fields.

## Rollback

Revert KMD-231. Media upload/scanning behavior from KMD-228 through KMD-230 remains unchanged; only the administrative aggregate status endpoint is removed.

## External proof still required

KMD-231 does not prove or claim a real production malware-scanning provider, secret-manager integration, egress policy, provider SLA, quarantine analyst workflow, storage isolation, production alerts, physical mobile upload validation, or a deployed production environment.

The KMD-228 market-release blocker remains active until those external requirements that materially affect safe media release are actually validated.

## Merge gate

Merge only after the exact PR head passes dependency audit, Prisma generation, migration deploy, zero drift, full monorepo build, root tests, Chromium Web E2E and PostgreSQL API E2E.
