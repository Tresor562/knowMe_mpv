# KMD-195 — Guest gameplay persistence boundary

## Phase

Play for Everyone — Guest Play foundation.

## Goal

Introduce dedicated persisted session/action/receipt models for future Guest Play without weakening or reusing the account-bound `GameSession`, `GameParticipant`, `GameAction` and `GameActionReceipt` authority model.

## Delivered

- adds `GuestGameSessionStatus` with bounded guest-only lifecycle states;
- adds `GuestGameSession` keyed to `GuestIdentity` rather than a `User` account;
- stores authoritative state, state hash, sequence, seed, definition version and bounded expiry for future deterministic guest games;
- adds `GuestGameAction` with server sequence and per-session guest idempotency keys;
- adds `GuestGameActionReceipt` so future retries can return an authoritative prior result instead of duplicating an action;
- cascades sessions, actions and receipts when the owning `GuestIdentity` is physically purged;
- adds a pure policy that refuses persistence for revoked, blocked, converted or expired guests;
- caps a future guest gameplay session at 30 minutes and never beyond the `GuestIdentity.expiresAt` boundary;
- leaves `GuestPlayService.policy().supportsGameplay` unchanged at `false`;
- does not add a public session/action endpoint and does not make any current game guest-eligible.

## Why the account game tables are not reused

The existing game platform binds `GameSession.ownerId`, `GameParticipant.userId`, `GameAction.actorId` and receipts to authenticated account identity semantics. A temporary guest is deliberately not a `User`. Creating fake account IDs or overloading those columns would weaken authorization, account deletion semantics and replay/audit interpretation.

KMD-195 therefore creates a separate persistence boundary. A future KMD may share deterministic engine logic, but must not silently merge guest identity and account identity authority.

## Privacy and security boundaries

- guest gameplay rows contain `guestId`, never an account `userId`;
- no real identity, contacts, private social graph or device identifier is introduced;
- deleting the `GuestIdentity` cascades its gameplay rows;
- session expiry cannot exceed guest identity expiry;
- client-provided score, winner, reward, rating or economy state is not introduced;
- action idempotency and state hashes are represented in the schema before any public action route exists;
- KMD-193 account conversion still transfers no gameplay data;
- KMD-194 `/games/guest` remains empty and `playEnabled: false` until a reviewed deterministic guest game is introduced.

## Migration

`20260823175000_kmd_195_guest_game_session_boundary`

The migration only adds guest gameplay tables, enum, indexes and cascade foreign keys. It does not alter account-bound game tables.

## Validation gate

Before merge, the exact PR head must pass:

1. production dependency audit;
2. Prisma generation across the schema folder;
3. clean `prisma migrate deploy` on PostgreSQL 16 including the KMD-195 migration;
4. zero Prisma drift between migrations and the datamodel;
5. complete monorepo build;
6. unit tests including guest eligibility/expiry/storage isolation policy;
7. Chromium Web E2E;
8. PostgreSQL API E2E.

## Rollback

Before public Guest Gameplay exists, revert the KMD-195 merge and drop only the KMD-195 guest gameplay tables/type if the migration has already been applied in a disposable/pre-production database. Never roll a production schema backward destructively after guest gameplay data exists; use a forward corrective migration instead.

## Required follow-up before public Guest Play

- implement the first deterministic solo engine explicitly reviewed as guest-safe;
- wire server-only session creation against an explicit `guestEligible` game allowlist;
- implement authoritative/idempotent guest actions and receipts using these models;
- add gameplay-specific abuse/rate limits;
- define conversion rules before any guest gameplay data becomes transferable to accounts;
- add PostgreSQL E2E for the first real guest session/action lifecycle;
- only then expose Web Instant Game UX and change `/games/guest` to `playEnabled: true` for a reviewed game.

## External evidence not claimed

This KMD does not prove real production purge scheduling, production database retention, physical-device behavior, legal compliance, store review or a deployed Guest Play experience.
