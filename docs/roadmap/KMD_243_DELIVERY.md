# KMD-243 — Media quarantine purge backlog visibility

## Goal

Make persisted quarantine-retention purge pressure visible to authorized operations staff without exposing media, users, storage keys, hashes, scanner payloads or provider secrets.

## Delivered

- extends `GET /admin/operations/media-quarantine-retention` with a bounded `backlog` object;
- reports expired quarantined rows that are eligible for retention processing;
- reports retry rows that are due now, retries already scheduled in the future, and rows that have reached the 24-hour retry-backoff cap;
- reports only the next scheduled retry timestamp, never media-level identifiers;
- preserves JWT + `audit.read` authorization;
- keeps the existing process-local worker health snapshot unchanged;
- adds unit coverage for disabled and configured telemetry plus E2E response-contract coverage.

## Backlog contract

`backlog` contains only:

- `expiredQuarantined`;
- `retryDue`;
- `retryScheduled`;
- `maxBackoffRetries`;
- `nextScheduledRetryAt`.

`maxBackoffRetries` counts `PURGING` rows whose persisted attempt count has reached the first attempt number where KMD-242's exponential delay is capped at 24 hours. It is an operational pressure signal, not an automatic incident declaration.

## Privacy and security boundaries

This endpoint does not expose:

- media IDs or file names;
- owner/user IDs;
- storage keys;
- hashes or file contents;
- scanner URLs, credentials, references or raw responses;
- audit rows.

It does not trigger a purge, rescan, retry or any other write.

## Migration

No Prisma migration is required. KMD-243 reads the persisted retry metadata introduced by KMD-242.

## Rollback

Revert KMD-243. The KMD-242 retry/backoff worker continues to operate unchanged; only the additional aggregate backlog telemetry disappears.

## Validation

Required before merge:

1. dependency/security audit;
2. Prisma generate and migration deploy;
3. zero migration drift;
4. monorepo build;
5. root/unit tests including KMD-243 telemetry tests;
6. Chromium Web E2E;
7. PostgreSQL API E2E including the retention endpoint contract.

## Not claimed

KMD-243 does not prove external alert delivery, production object-store deletion, legal approval of retention periods, distributed worker coordination, malware-provider readiness, production deployment, physical mobile validation or store publication.
