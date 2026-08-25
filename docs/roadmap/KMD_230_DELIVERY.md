# KMD-230 — Authoritative external media scanner integration

## Goal

Wire the KMD-229 external scanner adapter into the authoritative production upload path while preserving quarantine on every ambiguous or unsafe outcome.

## Changes

- `MediaService.completeUpload()` now awaits the scanner verdict before deriving media availability.
- Production uploads route through `ExternalMediaScannerService` after MIME/content validation and quota checks.
- `CLEAN` is the only verdict that can produce `AVAILABLE`.
- `INFECTED` and `UNAVAILABLE` remain `QUARANTINED` and cannot receive a download grant.
- The deterministic EICAR signature remains a local fast-path and is never sent to the external provider.
- Non-production keeps the deterministic local signature behavior used by development/tests.
- Adds explicit server configuration placeholders for `MEDIA_SCANNER_URL`, `MEDIA_SCANNER_TOKEN` and `MEDIA_SCANNER_TIMEOUT_MS`.
- Extends unit coverage for external routing, unavailable verdict propagation and EICAR short-circuiting.

## Security rationale

The upload path remains fail-closed. A network failure, timeout, malformed provider response, provider HTTP error, missing/unsafe configuration or explicit infection verdict can never make media downloadable.

The external scanner is called only after KnowMe has validated the binary MIME against the upload session allowlist. The scanner receives the raw bytes, the detected MIME type and a SHA-256 digest; filenames, account identifiers and conversation identifiers are not sent by the adapter.

## Release boundary

The KMD-228 market-release blocker remains intentionally active. KMD-230 proves the application integration and automated behavior, but does not prove a real production malware-scanning provider or target-environment controls.

Do not remove that blocker until the selected provider is configured and validated in the real deployment environment with EICAR/benign fixtures, timeout/failure exercises, secret-manager configuration, network policy and operational ownership evidence.

## Tests

Coverage verifies that:

- development/test media does not contact the external scanner;
- ordinary production media is routed to the external scanner with the detected MIME type;
- an external `CLEAN` verdict is propagated;
- an external `UNAVAILABLE` verdict is propagated so the asset remains quarantined;
- EICAR is classified locally as `INFECTED` without contacting the provider.

KMD-229 separately covers adapter transport/configuration/response validation.

## Migration

No Prisma migration and no persisted-user-data migration are required. Existing quarantined assets are not automatically rescanned or promoted.

## Rollback

Revert KMD-230. KMD-229 remains present but unused by the authoritative upload path, and KMD-228 resumes quarantining every ordinary production upload.

## External proof still required

KMD-230 does not prove or claim:

- a real scanner provider account or contract;
- production credentials in a secret manager;
- DNS/TLS ownership or network egress allow-listing;
- scanner SLA, detection depth, supported formats or signature freshness;
- concurrency/throughput under production upload load;
- analyst quarantine/review and re-scan operations;
- real-device mobile upload behavior;
- production deployment.

## Merge gate

Merge only after the exact PR head passes dependency audit, Prisma generation, migration deploy, zero drift, full monorepo build, root tests, Chromium Web E2E and PostgreSQL API E2E.
