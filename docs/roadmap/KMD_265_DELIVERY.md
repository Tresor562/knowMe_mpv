# KMD-265 — Production smoke evidence artifact

## Goal

Make the already-authoritative production deployment smoke (KMD-263) and metrics smoke (KMD-264) produce a bounded, retainable artifact that can be hashed and referenced during release evidence review without leaking the metrics bearer token.

## Delivered

- Adds `pnpm release:smoke:evidence`.
- Reuses the existing KMD-263 deployment verifier and KMD-264 metrics verifier rather than duplicating their network/security logic.
- Requires a canonical HTTPS production origin, exact release commit, exact release version, metrics token, bounded timeout, and explicit output path.
- Writes an exclusive JSON artifact only after both smoke checks succeed.
- Refuses silent overwrite through exclusive file creation (`wx`).
- Uses restrictive file permissions (`0600`) where supported.
- Returns and prints the SHA-256 of the exact artifact bytes so the retained file can be bound to a market-readiness evidence entry.
- Never stores the metrics bearer token, response bodies, cookies, Authorization header, or infrastructure secrets in the artifact.

## Artifact contract

The artifact contains only:

- schema/type identifiers;
- observation timestamp;
- normalized production origin;
- exact release commit and version;
- successful deployment-readiness and metrics-surface checks with their HTTPS endpoints.

It intentionally does not contain the metrics snapshot itself. The smoke command proves reachability/authentication and contract validity at one instant, not long-term telemetry retention or alert delivery.

## Usage

Example shape:

```sh
METRICS_BEARER_TOKEN='...' \
KNOWME_RELEASE_COMMIT='0123456789abcdef0123456789abcdef01234567' \
KNOWME_RELEASE_VERSION='1.0.0-rc.1' \
pnpm release:smoke:evidence -- \
  --url https://api.example.com \
  --output ./release-evidence/production-smoke.json
```

The command prints a SHA-256 digest after successful exclusive creation. Preserve the file through the release evidence retention process and use its digest only for the evidence item it actually supports.

## Tests

The KMD-265 suite verifies:

- a successful artifact has the bounded schema and exact release identity;
- the metrics bearer token is absent from the artifact bytes;
- SHA-256 is computed from the exact persisted serialization;
- both existing authoritative smoke verifiers receive the same origin and timeout;
- no file is written when either verifier fails;
- unsafe origins, output paths, and timeout values fail before network verification;
- an existing evidence file cannot be silently overwritten.

The suite is wired into the repository root `pnpm test` gate.

## Migration

No Prisma migration is required. Release operations must choose a protected evidence directory and preserve the produced artifact according to their release evidence policy.

## Rollback

Revert KMD-265. KMD-263 `release:smoke` and KMD-264 `release:metrics-smoke` remain available independently and no product data/schema is affected.

## Proof boundary

A KMD-265 artifact can support evidence that the exact candidate responded successfully to the two bounded smoke checks at `observedAt`. It does **not** prove:

- continuous external monitoring;
- alert delivery or on-call escalation;
- DNS/TLS ownership beyond the connection exercised by the smoke;
- long-term metrics retention;
- restore drills or RPO/RTO;
- legal/privacy approval;
- antimalware-provider production validation;
- physical Android/iOS validation;
- store submission or publication.

Those remain separate external market-readiness evidence and must not be marked verified solely because this artifact exists.
