# KMD-176 — Private media storage resilience

## Goal

Harden the KMD-175 private S3-compatible media adapter against short provider/network incidents without weakening authorization, privacy, or production fail-closed behavior.

## Delivered

- Bounded request timeout controlled by `MEDIA_S3_TIMEOUT_MS` (1,000..60,000 ms, default 30,000 ms).
- Bounded total attempts controlled by `MEDIA_S3_MAX_ATTEMPTS` (1..5, default 3).
- Retries only for transient HTTP statuses: 408, 425, 429 and 5xx.
- Network/timeout failures may be retried within the same bounded attempt budget.
- Permanent 4xx failures such as 401/403 are not retried.
- Every retry is freshly AWS SigV4-signed; storage credentials remain server-only.
- Exponential bounded retry delay (100 ms, 200 ms, then capped at 1,000 ms).
- Release preflight validates the production timeout/attempt bounds.
- Unit coverage verifies transient recovery, permanent failure behavior, attempt exhaustion and invalid configuration.

## Security/privacy boundaries

This KMD does not make media public, does not expose storage credentials, does not change grants or media authorization, and does not broaden accepted object keys. Error messages continue to expose only the remote HTTP status, not provider response bodies or credentials.

## Validation gate

Before merge, the exact PR head must pass dependency installation, Prisma setup, full monorepo build, unit tests, Chromium Web E2E and PostgreSQL API E2E.

## External proofs still required

A real market release still requires a configured private bucket/provider, least-privilege IAM, encryption at rest, lifecycle/retention policy, provider-side monitoring and an integration/failure drill against the actual production storage service. Those are deployment proofs and are not claimed by this KMD.

## Rollback

Revert the KMD-176 commit/PR. KMD-175 remains the baseline storage adapter and will return to one request with its previous 30-second timeout. No Prisma migration or stored-data transformation is involved, so rollback does not require database changes.
