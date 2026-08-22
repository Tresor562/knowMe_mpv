# KMD-175 — External private media storage

## Goal

Remove the API process filesystem as an acceptable production source of truth for user media and provide a private S3-compatible storage path that preserves KnowMe authorization, deletion and privacy boundaries.

## Changes

- Adds `MediaStorageService` as the single storage adapter used by the media domain.
- Keeps local filesystem storage only for development and automated tests.
- Adds an S3-compatible private object-storage driver implemented with server-side AWS Signature Version 4 and Node built-ins, so no storage credential is exposed to Web or Mobile clients.
- Routes upload persistence, authorized reads, asset deletion and account-cleanup deletion through the storage adapter.
- Preserves the existing database metadata, MIME detection, quotas, scanner/quarantine state, download grants, conversation/friend authorization and audit trail.
- Adds production release-preflight checks that reject local API disk and require an HTTPS object-storage endpoint, bucket, region and hardened server credentials.
- Documents the required environment variables in `.env.example`.

## Security and privacy boundaries

- The object bucket must remain private. KMD-175 does not create public object URLs or client-side storage credentials.
- Downloads still require KnowMe authentication plus the existing short-lived media download grant; the API fetches the object only after authorization succeeds.
- S3 access keys, secret keys and optional session tokens remain server-only and are never returned by media APIs or included in storage URLs.
- Object keys remain generated opaque basenames and traversal/nested arbitrary paths are rejected.
- Production S3 endpoints must use HTTPS.
- Storage failures do not downgrade to local disk in production.
- KMD-175 does not claim that a real bucket, lifecycle rule, encryption policy, replication policy or provider IAM policy has been physically configured. Those are deployment proofs.

## Compatibility and migration

There is no Prisma schema change. Existing `MediaAsset.storageKey` values remain compatible because KMD-175 keeps the same opaque generated filename format.

A deployment that already contains local production media must copy each object identified by `MediaAsset.storageKey` into the configured private bucket before switching `MEDIA_STORAGE_DRIVER` to `s3`. The database must not be rewritten solely for this migration.

## Validation gate

Before merge, the exact branch head must pass:

1. dependency installation;
2. Prisma generate/push against PostgreSQL;
3. full monorepo build;
4. complete unit suite including media-storage safety tests and release-preflight tests;
5. Chromium Web E2E;
6. PostgreSQL API E2E including existing media authorization/security coverage.

A real provider integration test is still required in the target deployment before market release. Repository CI proves request construction and application integration, not external bucket ownership or IAM correctness.

## Operational checklist

Before production traffic:

- create a private S3-compatible bucket in the chosen region;
- enable provider-side encryption at rest and TLS in transit;
- issue least-privilege credentials limited to object read/write/delete for the KnowMe media bucket;
- configure `MEDIA_STORAGE_DRIVER=s3` and the `MEDIA_S3_*` variables as secrets;
- run `pnpm check:release`;
- upload, download and delete a disposable media object through KnowMe in the real environment;
- verify the object cannot be fetched anonymously;
- verify account deletion removes owned objects;
- define provider retention/versioning/lifecycle rules consistent with KnowMe privacy and deletion obligations;
- monitor storage errors and capacity/cost.

## Rollback

Revert the KMD-175 merge. Development/test environments can return to local storage. Production must not silently fall back to process-local disk; if the external provider is unavailable, stop media writes or roll back to a previously validated durable storage configuration. There is no database migration rollback.
