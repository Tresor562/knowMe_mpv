# KMD-194 — Guest game eligibility gate

## Phase

Play for Everyone — Guest Play foundation.

## Goal

Create a fail-closed public contract that tells Web/Mobile which active games are actually approved for unauthenticated Guest Play, without inferring safety from player count, category or catalog presence.

## Delivered

- adds public `GET /games/guest`;
- returns only games explicitly marked `guestEligible` in the authoritative Game Center metadata;
- exposes `playEnabled` as a derived value instead of a client-controlled flag;
- keeps every currently shipped game ineligible for guest play;
- keeps unknown/future games ineligible by default, even when they are solo games;
- preserves existing server-authoritative score/result/economy boundaries;
- adds unit and PostgreSQL-backed API E2E coverage for the closed-by-default behavior.

## Why the current response is intentionally empty

Pulse Duel and Affinity Mirror currently rely on authenticated user participants. KMD-194 must not silently reinterpret those account-bound participation records as guest identities. Therefore `GET /games/guest` currently returns:

```json
{
  "playEnabled": false,
  "games": []
}
```

This is a safety gate, not a claim that Guest Play is already publicly usable.

## Security and privacy boundaries

- catalog publication never authorizes session creation or game actions;
- a game cannot become guest-playable merely because `minPlayers <= 1`;
- unknown engines and newly registered definitions fail closed;
- no guest token, account token, score, replay state, private session or social graph data is returned by the guest catalog;
- economic stakes remain forbidden by the Game Center catalog contract;
- KMD-193 conversion semantics are unchanged.

## Schema and migration

No Prisma migration is required. This KMD only introduces a public eligibility projection over existing active definitions.

## Validation gate

Before merge, the exact PR head must pass:

1. production dependency audit;
2. Prisma generation;
3. clean `prisma migrate deploy` on PostgreSQL 16;
4. zero Prisma drift;
5. complete monorepo build;
6. unit tests including unknown-solo fail-closed coverage;
7. Chromium Web E2E;
8. PostgreSQL API E2E including the new `/games/guest` contract.

## Rollback

Revert the KMD-194 merge. This removes `/games/guest` and the dedicated guest-catalog projection without changing persisted data.

## Required follow-up before public Guest Play

- introduce a guest-safe participation/session identity model without weakening account-bound `GameParticipant` authority;
- add at least one deterministic game explicitly designed for guest play;
- ensure guest actions remain server-authoritative and idempotent;
- define abuse/rate-limit policy for gameplay, not only identity creation;
- wire Web Instant Game UX only after at least one game is truly eligible;
- keep account conversion/export/deletion semantics explicit when transferable gameplay records are introduced;
- prove KMD-192 retention purge scheduling in the real production environment.
