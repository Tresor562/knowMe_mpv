# KMD-193 — Guest-to-account conversion boundary

## Phase

Play for Everyone — Guest Play foundation.

## Goal

Allow an already-authenticated KnowMe account to claim one still-active GuestIdentity exactly once, without pretending that gameplay data exists or weakening account authentication.

## Delivered

- adds authenticated `POST /guest/convert`;
- keeps normal account JWT authentication in `Authorization`;
- accepts the separate bounded guest credential only through `x-knowme-guest-token`;
- validates the raw guest credential shape before database authority;
- atomically converts only an ACTIVE, unexpired and never-converted GuestIdentity;
- records `status=CONVERTED`, `convertedUserId`, `convertedAt` and `lastSeenAt`;
- immediately invalidates the guest credential for resume/reuse after successful conversion;
- requires the target user to still exist inside the same database transaction;
- keeps malformed, expired, revoked, blocked, missing and already-converted credentials behind the same generic unauthorized boundary;
- adds endpoint-specific throttling;
- adds unit and PostgreSQL E2E coverage for authentication, one-time conversion and credential invalidation.

## Deliberate transfer boundary

Guest gameplay is still disabled at this stage, so KMD-193 transfers no scores, achievements, ranking, economy, social graph or game history. The response states this explicitly instead of inventing migrated data.

Future Guest Play KMDs may introduce narrowly defined transferable records only after guest-safe gameplay exists. Any such data must remain server-authoritative and must define retention, ownership and one-time migration semantics separately.

## Privacy and security

- the raw guest token is never persisted;
- the account JWT and guest credential remain separate credential domains;
- conversion requires both a currently valid authenticated account session and a valid guest credential;
- no endpoint can convert a guest to an arbitrary user id supplied by the client;
- the conversion write uses an atomic conditional update, preventing two successful claims of the same guest;
- converted guest credentials lose authorization value immediately;
- no real identity, contacts, private messages or sensitive profile data are copied from GuestIdentity.

## Schema and migration

No new migration is required. KMD-191 already introduced `status`, `convertedUserId` and `convertedAt` specifically for a later explicit conversion block.

## Validation gate

Before merge, the exact PR head must pass:

1. production dependency audit;
2. Prisma generation;
3. clean `prisma migrate deploy` on PostgreSQL 16;
4. zero Prisma drift;
5. complete monorepo build;
6. unit tests including one-time conversion semantics;
7. Chromium Web E2E;
8. PostgreSQL API E2E including authenticated conversion and reuse rejection.

No physical-device, legal, parental-consent-provider, production scheduler or store validation is claimed.

## Rollback

Application rollback: revert the KMD-193 merge, returning `/guest/policy.conversionEnabled` to false and removing `POST /guest/convert`.

Already-converted rows must not be silently reverted to ACTIVE: the original raw guest credential is intentionally unavailable and conversion is a security-sensitive lifecycle transition. Any production correction must therefore use a reviewed forward data repair rather than resurrecting old guest credentials.

## Required follow-up before public Guest Play

- prove the retention purge is actually scheduled in production;
- define regional age-gate/consent behavior before guest gameplay;
- define stronger gameplay abuse controls;
- mark individual games as guest-safe;
- allow guest participation without granting client score/winner authority;
- add Web Instant Game UX;
- once guest gameplay produces transferable data, define explicit per-domain migration rules and account export/deletion behavior.
