# KMD-192 — Guest Identity retention and physical purge

## Phase

Play for Everyone — Guest Play privacy foundation.

## Goal

Close the retention gap deliberately left by KMD-191 by providing a deterministic, idempotent server-side command that physically deletes guest identity rows after their credential expiry plus a bounded safety grace.

## Delivered

- adds `GuestRetentionService`;
- physically deletes `GuestIdentity` rows whose `expiresAt` is at least one hour in the past;
- uses a one-hour grace window so a small clock/scheduler delay cannot delete a just-expired row prematurely;
- adds `pnpm guest:purge` at repository root and `pnpm --filter @knowme/api guest:purge` in the API workspace;
- runs the purge through the normal Nest application context and Prisma connection;
- prints only aggregate deletion count, cutoff and grace duration, never guest IDs, aliases, token hashes or other identity data;
- is naturally idempotent when no eligible rows remain;
- adds unit tests for cutoff semantics and query boundaries;
- adds PostgreSQL E2E proving an old expired row is physically removed while an identity still inside grace and an unexpired identity survive.

## Retention rule

A guest credential is authorization-invalid as soon as `expiresAt` is reached, as established by KMD-191.

Physical deletion is eligible only when:

`expiresAt <= now - 1 hour`

The one-hour grace is an operational safety margin, not an extension of authentication validity.

Because GuestIdentity is intentionally minimal and guest conversion is not yet enabled, KMD-192 deletes all guest rows that cross the retention boundary regardless of lifecycle status. Future conversion work must not silently extend this retention window; if temporary migration linkage is required, that policy must be explicitly reviewed and versioned.

## Operational command

```bash
pnpm guest:purge
```

Required runtime dependency: the normal API `DATABASE_URL` and deployed Prisma migrations.

The command returns an aggregate JSON result such as:

```json
{"deleted":12,"cutoff":"2026-08-22T20:00:00.000Z","graceSeconds":3600}
```

It intentionally does not expose deleted record identifiers.

## Scheduling boundary

This repository now contains the physical purge mechanism, but KMD-192 **does not claim that an external scheduler is configured in production**.

Before public Guest Play is enabled, the target hosting platform must invoke `pnpm guest:purge` on a documented recurring schedule. That scheduler, its credentials, execution history, alerting and failure recovery are infrastructure evidence and must be verified on the actual deployment.

A reasonable initial production cadence is hourly, but the hosting configuration remains external to this repository unless infrastructure-as-code for the selected provider is added later.

## Failure behavior

- database failures produce a non-zero process exit through the command runner;
- no deletion is performed client-side;
- there is no HTTP purge endpoint to attack or accidentally expose;
- running the command twice is safe;
- no guest credential is made valid by cleanup failure: authorization expiry remains enforced independently by KMD-191.

## Schema and migration

No new schema or migration is required. KMD-192 operates on the KMD-191 `GuestIdentity.expiresAt` index and model.

## Validation gate

Before merge, the exact PR head must pass:

1. production dependency audit;
2. Prisma generation;
3. clean `prisma migrate deploy` against PostgreSQL 16;
4. zero Prisma drift;
5. complete monorepo build;
6. unit tests including guest retention tests;
7. Chromium Web E2E;
8. PostgreSQL API E2E including `guest-retention.e2e-spec.ts`.

The repository command itself may also be invoked against a disposable database for operational smoke testing, but no real production database purge is claimed.

## Rollback

Application rollback: revert KMD-192. This removes the purge service and command but does not restore rows already physically deleted.

Therefore rollback cannot promise recovery of expired guest identities. That is intentional: expired guest rows are privacy-minimized ephemeral data and should not be restored merely to undo the cleanup code.

## Next required Guest Play work

Before guest gameplay is public, remaining boundaries include:

- guest-to-account conversion with one-time, minimal data transfer;
- guest-safe Game Platform participation without weakening authoritative state;
- age/region gating and parental/legal policy where applicable;
- gameplay-specific anti-abuse limits;
- Web Instant Game UX;
- deployment proof that the purge command actually runs on schedule.
