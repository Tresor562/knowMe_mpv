# KMD-229 — External media scanner adapter boundary

## Goal

Add a production-grade, provider-neutral HTTP adapter for malware scanning without weakening the KMD-228 fail-closed release boundary.

## Changes

- Adds `ExternalMediaScannerService` as a dedicated NestJS provider.
- Uses HTTPS-only scanner endpoints with no URL credentials, query string or fragment.
- Uses a dedicated bearer token and rejects tokens shorter than 32 characters.
- Sends the file as `application/octet-stream` with only its MIME type and SHA-256 digest as bounded metadata.
- Enforces a bounded scanner timeout between 500 ms and 10 seconds.
- Accepts only strict JSON responses with exactly `verdict` and `reference` fields.
- Accepts only `CLEAN` or `INFECTED` as authoritative external verdicts.
- Treats missing configuration, malformed responses, HTTP errors, timeouts and network failures as `UNAVAILABLE`.
- Caps accepted response bodies at 4 KiB and scanner references at 128 characters.
- Registers the adapter in `MediaModule` for the next integration milestone.

## Configuration contract

The adapter reads these server-only variables:

- `MEDIA_SCANNER_URL`: HTTPS endpoint without embedded credentials, query string or fragment.
- `MEDIA_SCANNER_TOKEN`: dedicated bearer token, at least 32 characters.
- `MEDIA_SCANNER_TIMEOUT_MS`: canonical integer in the range 500..10000.

These values are deliberately not treated as launch proof by KMD-229. Provider ownership, network policy and target-environment validation remain external requirements.

## Security rationale

KMD-228 correctly stopped classifying arbitrary production uploads as clean. KMD-229 prepares the narrow authenticated scanner transport needed to remove that blocker later, while preserving fail-closed behavior for every ambiguous or unavailable scanner outcome.

The adapter does not log or return the bearer token, scanner URL credentials, raw provider error bodies or uploaded file content.

## Product boundary

KMD-229 does **not** yet wire the adapter into `MediaService.completeUpload()`. Therefore production uploads remain quarantined under KMD-228 and `pnpm check:release` remains intentionally blocked by the KMD-228 media-scanner preflight.

The next milestone must integrate the adapter into the authoritative upload path, preserve quarantine on `UNAVAILABLE`/`INFECTED`, add end-to-end tests, and still require real provider validation before opening the market-release gate.

## Tests

Coverage verifies:

- fail-closed behavior when configuration is absent;
- rejection of insecure URLs, weak tokens and malformed timeouts;
- SHA-256 and MIME metadata transmission;
- strict clean-verdict parsing;
- fail-closed behavior on unknown verdicts, extra response fields, malformed references and HTTP errors.

## Migration

No Prisma migration and no persisted-user-data migration are required.

## Rollback

Revert KMD-229. KMD-228 continues to quarantine arbitrary production media and keeps the release blocker active.

## External proof still required

KMD-229 does not prove or claim:

- a real malware-scanning provider account;
- provider credentials stored in a production secret manager;
- DNS/TLS ownership or certificate validation of the scanner endpoint;
- egress allow-listing or private-network routing;
- provider SLA, supported formats, detection depth or signature freshness;
- concurrency/throughput under production load;
- analyst quarantine/review operations;
- physical mobile upload behavior;
- production deployment.

## Merge gate

Merge only after the exact PR head passes dependency audit, Prisma generation, migration deploy, zero drift, full monorepo build, root tests, Chromium Web E2E and PostgreSQL API E2E.
