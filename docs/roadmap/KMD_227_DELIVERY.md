# KMD-227 — Media upload memory budget

## Goal

Make the in-memory multipart upload ceiling an explicit market-release decision instead of a hard-coded 25 MiB assumption.

## Changes

- Preserves Multer `memoryStorage()` and the existing one-file boundary.
- Replaces the hard-coded 25 MiB `fileSize` limit with `MEDIA_UPLOAD_MAX_BYTES`.
- Requires the value explicitly in production and keeps the historical 25 MiB default only outside production.
- Bounds the production value to 1 MiB..25 MiB and requires a canonical positive integer.
- Adds matching runtime and release-preflight tests.
- Wires the release preflight into root `pnpm test` and `pnpm check:release`.

## Security and reliability rationale

Each accepted multipart file is buffered in API process memory before the existing media validation/storage path runs. A hard-coded maximum does not prove that the deployed container has enough memory for concurrent uploads. Requiring an explicit ceiling makes the memory-risk decision visible and prevents a market release from silently inheriting a development assumption.

The upper bound deliberately never exceeds the pre-KMD-227 25 MiB behavior, so this milestone cannot widen the upload memory exposure.

## Tests

Coverage verifies the non-production compatibility default, production requirement, inclusive 1 MiB/25 MiB bounds, canonical integer parsing, and rejection of zero, fractions, negatives and out-of-range values.

## Migration

No Prisma migration and no persisted user-data change. Production operators must set `MEDIA_UPLOAD_MAX_BYTES` based on the actual API memory limit, expected concurrency and real mobile/network testing before release.

## Rollback

Revert KMD-227. The controller returns to a fixed 25 MiB in-memory upload ceiling. Existing media data is unaffected.

## Deliberate boundary

KMD-227 does not prove container memory sizing, concurrent-upload capacity, reverse-proxy body limits, mobile upload reliability, object-storage throughput, malware scanning capacity or load-test results. Those remain target-environment validations.

## Merge gate

Merge only after the exact PR head passes dependency audit, Prisma generation, migration deploy, zero drift, complete monorepo build, root tests including KMD-227, Chromium Web E2E and PostgreSQL API E2E.
