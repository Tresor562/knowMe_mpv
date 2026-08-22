# KMD-190 — Mobile Game Center V2 surface

## Phase

Play for Everyone — Game Center V2.

## Goal

Expose the Game Center V2 catalog and private game library on the authenticated Mobile experience without moving game authority, scores, results or session state into the client.

## Delivered

- adds `MobileGameCenterExperience` for React Native;
- consumes the public `/games/center` catalog and authenticated `/games/library` projection;
- provides client-side search and category filtering;
- shows Continue Playing and pending invitations from the bounded private library projection;
- supports idempotent favorite add/remove through the existing authenticated favorite endpoints;
- exposes the new Mobile Game Center from the profile experience while retaining the existing authoritative game-session UI as a separate block;
- adds pure model helpers and automated tests for category projection, search/filtering and favorite-key isolation;
- wires those model tests into the Mobile package `test` script so the root Turbo test gate executes them.

## Privacy and authority boundaries

KMD-190 does not introduce GuestIdentity, anonymous gameplay, client-authoritative scores, client-authoritative winners, rating, economy, matchmaking or rewards.

The Mobile Game Center consumes only the bounded DTOs introduced by KMD-186 through KMD-188. It does not request or render game seeds, authoritative state, state hashes, result payloads, action history, replay internals, owner/winner IDs or identities of unrelated participants from `/games/library`.

Favorites remain private account preference data. Favorite mutations require the existing authenticated session and are server-authorized.

## Accessibility and resilience

- search has an explicit accessibility label;
- category and favorite controls expose button/selection state;
- catalog/library failures are surfaced through an alert role instead of failing silently;
- empty filter results produce an explicit message;
- the existing authoritative game experience remains available as a fallback entry for actual session management.

## Data and schema

No Prisma schema or migration is required. KMD-190 consumes the existing Game Center and game-library APIs.

## Validation gate

Before merge, the exact PR head must pass:

1. dependency installation and production dependency audit;
2. Prisma generation;
3. clean `prisma migrate deploy` against PostgreSQL 16;
4. zero Prisma drift;
5. complete monorepo build, including Mobile TypeScript;
6. root unit/test gate, including the new Mobile Game Center model tests;
7. Chromium Web E2E;
8. PostgreSQL API E2E.

No physical iOS/Android interaction test is claimed by this KMD. Real-device validation remains external evidence.

## Rollback

Revert the Mobile Game Center files, remove its profile integration, remove the Mobile package test script and this delivery document. No database rollback is required.

## Follow-up

After KMD-190 is green and merged, the next free KMD should move into the Guest Play boundary only after guest identity, token lifetime, consent/age gating, abuse controls, data minimization, conversion semantics and deletion/expiry behavior are explicitly designed and tested.
