# KMD-188 — Private Game Center library

## Phase

Play for Everyone — Game Center V2.

## Goal

Give an authenticated player one privacy-safe `Mes jeux` projection that combines favorites, resumable sessions, pending invitations and recent game history without exposing authoritative game internals or another account's activity.

## Delivered

- `GET /games/library`, protected by JWT authentication;
- private favorites reused from KMD-187;
- `continuePlaying` for the requesting account's joined WAITING/ACTIVE sessions;
- `invitations` for the requesting account's pending invitations;
- `recent` for terminal sessions already joined by the requesting account;
- explicit expiry projection so a stale active/waiting session is not offered as resumable;
- bounded reads: at most 80 memberships, 50 sessions and 20 cards per returned session group;
- minimal session projection containing game identity, lifecycle status, turn hint and timestamps only;
- unit and PostgreSQL E2E coverage for classification, account isolation and payload minimization.

## Privacy and authority boundaries

The endpoint is account-scoped from `req.user.userId`. It does not expose server state, seeds, result payloads, winner IDs, owner IDs, replay internals, actions, receipts or other participant identities. It does not accept or calculate score, reward, rating or economic value.

Favorites remain private. Public catalog endpoints remain public and unchanged. KMD-188 does not introduce Guest Play, matchmaking, rankings or client authority.

## Data and schema

No new schema or migration is required. KMD-188 reads the authoritative `GameFavorite`, `GameParticipant`, `GameSession` and `GameDefinition` data already present after KMD-187.

The library is a derived projection and does not create a second source of truth.

## Validation gate

Before merge, the exact PR head must pass:

1. dependency installation and production dependency audit;
2. Prisma generation;
3. clean `prisma migrate deploy` on PostgreSQL 16;
4. migration/datamodel zero-drift check;
5. complete monorepo build;
6. unit tests;
7. Chromium Web E2E;
8. PostgreSQL API E2E including `/games/library` isolation and minimal payload assertions.

## Rollback

Application rollback is a normal revert of the KMD-188 controller/service/tests/docs changes. There is no database rollback because KMD-188 adds no schema.

## Follow-up

The next Game Center block can build real Web/Mobile `Mes jeux` surfaces on this endpoint, then move toward Guest Play and Web Instant Games according to the Play for Everyone roadmap.
