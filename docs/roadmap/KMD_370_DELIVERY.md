# KMD-370 — Object-storage retained evidence semantic preflight

## Goal

Harden the KMD-369 object-storage release proof chain before it is promoted into market-release evidence. KMD-369 can generate a retained schema-v1 smoke artifact from a real S3-compatible provider; KMD-370 adds a strict semantic preflight so a malformed, weakened or hand-edited artifact cannot be treated as equivalent merely because it is valid JSON.

## Delivered

- adds `scripts/media-storage-provider-smoke-evidence-preflight.mjs`;
- reads retained evidence through the descriptor-bound safe reader already used by release evidence tooling;
- requires the exact KMD-369 schema-v1 top-level and nested field sets;
- requires `kind=knowme-object-storage-provider-smoke` and `status=PASSED`;
- validates canonical observation time and rejects materially future timestamps;
- requires lowercase SHA-256 endpoint and bucket digests;
- validates the bounded region identifier;
- requires the canonical 32-byte canary size;
- requires all five KMD-369 proof checks to be exactly `true`;
- refuses unknown top-level fields, preventing accidental retention of raw provider/bucket material from silently entering the evidence path.

The preflight can be executed directly:

```bash
node scripts/media-storage-provider-smoke-evidence-preflight.mjs \
  --artifact ./evidence/object-storage.json
```

## Tests

The existing root `pnpm test` path already executes `scripts/media-storage-provider-smoke.test.mjs`. KMD-370 extends that suite to prove:

1. a genuine KMD-369 artifact passes semantic validation;
2. a weakened check such as `anonymousReadDenied=false` fails closed;
3. an unknown/raw field is rejected by the exact schema contract;
4. a materially future `observedAt` is rejected.

The original KMD-369 network-sequence tests remain intact.

## Migration

No Prisma migration and no user-data migration.

## Rollback

Revert KMD-370. KMD-369's provider smoke remains available, but retained artifacts again lack this dedicated semantic preflight. Runtime storage behavior and existing objects are unchanged.

## Proof boundary

KMD-370 validates only the structure and semantics of a retained KMD-369 artifact. It does not contact production storage, does not prove provider IAM, encryption, versioning, lifecycle, replication, durability or throughput, and does not itself add a new market-release evidence slot. A real operator execution of KMD-369 against the production bucket is still required before any production storage claim can be made. Binding this validated artifact into the canonical market-release manifest remains a later delivery.
