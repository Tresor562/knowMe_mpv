# KMD-369 — Object-storage provider smoke

## Goal

Add a release-operator smoke for the private S3-compatible media store so KnowMe can prove basic provider connectivity, confidentiality and cleanup behavior against the real configured bucket before market release.

This delivery does not replace KMD-175's application storage adapter or claim production evidence from CI. CI exercises the smoke contract with synthetic responses only.

## Command

```bash
MEDIA_S3_ENDPOINT="https://..." \
MEDIA_S3_BUCKET="..." \
MEDIA_S3_REGION="..." \
MEDIA_S3_ACCESS_KEY_ID="..." \
MEDIA_S3_SECRET_ACCESS_KEY="..." \
pnpm release:object-storage:smoke --output ./evidence/object-storage.json
```

Optional:

```bash
MEDIA_S3_SESSION_TOKEN="..."
KNOWME_OBJECT_STORAGE_SMOKE_TIMEOUT_MS=10000
```

The endpoint must be canonical HTTPS. The timeout is bounded to 1,000..60,000 ms.

## Proof sequence

The smoke creates one cryptographically random disposable object key and random 32-byte body, then requires this exact sequence:

1. authenticated SigV4 `PUT` succeeds;
2. an unsigned `GET` cannot retrieve the object (`200` is a hard failure; only privacy-safe refusal/not-found statuses are accepted);
3. authenticated `GET` succeeds and returns exactly the uploaded bytes;
4. authenticated `DELETE` succeeds;
5. authenticated `GET` after deletion returns `404`.

If any step fails after creation, a best-effort authenticated delete is attempted in `finally` so the release canary is not intentionally left behind.

## Evidence artifact

A successful run may write a schema-v1 `knowme-object-storage-provider-smoke` artifact. It retains only bounded facts:

- observation timestamp;
- SHA-256 of the canonical endpoint;
- SHA-256 of the bucket name;
- region;
- canary byte size;
- boolean results for signed put/read/delete, anonymous-read denial and post-delete absence.

The artifact never stores the endpoint URL, bucket name, access key, secret key, session token, object key or object bytes. Output is created exclusively (`wx`) with restrictive permissions when supported and is never overwritten.

## Tests

The root `pnpm test` suite now includes deterministic regressions for:

- successful signed PUT / private anonymous probe / byte-identical signed GET / DELETE / post-delete 404;
- failure when the object is anonymously readable;
- failure when downloaded bytes differ from the uploaded canary;
- best-effort cleanup on post-create failures;
- refusal of non-HTTPS endpoints;
- absence of raw endpoint, bucket and credentials from the retained artifact.

## Migration

No Prisma migration and no user-data migration.

## Rollback

Revert KMD-369. This removes only the provider-smoke command, tests and documentation. Runtime media storage, database state and existing media objects are unchanged.

## Proof boundary

A green repository CI proves only the signing, sequencing, privacy-failure and cleanup contract against mocked provider responses. It does **not** prove that the production bucket exists, that IAM is least privilege, that provider-side encryption/versioning/lifecycle/replication is correctly configured, that real provider durability or throughput meets requirements, or that account deletion has been executed against the production bucket.

Before market release, an operator still needs to run `pnpm release:object-storage:smoke` with the real production object-storage configuration and retain the resulting artifact. Provider/IAM/lifecycle settings and user-level deletion behavior require their own production evidence.