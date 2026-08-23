# KMD-197 — Guest Quick Math authoritative lifecycle

## Status

Implementation branch. Keep draft until the exact head passes the repository merge gate.

## Purpose

Make the first Play for Everyone game genuinely playable before account creation without weakening the server-authoritative Game Platform or mixing temporary guest identities with account-bound game participants.

KMD-197 connects the KMD-195 Guest gameplay persistence boundary to the KMD-196 deterministic Quick Math engine.

## Public capability

An active GuestIdentity can now:

1. discover Quick Math through `GET /games/guest`;
2. create an idempotent temporary game session;
3. read only its own session;
4. submit idempotent START/ANSWER actions;
5. complete all five rounds without creating an account.

Routes:

- `POST /guest/games/quick-math/sessions`
- `GET /guest/games/sessions/:sessionId`
- `POST /guest/games/sessions/:sessionId/actions`

All gameplay routes require the opaque Guest Bearer credential created by `POST /guest/sessions`.

## Authority and isolation

The Guest lifecycle does not use account `GameSession` / `GameParticipant` rows.

It uses only:

- `GuestGameSession`;
- `GuestGameAction`;
- `GuestGameActionReceipt`;
- the owning `GuestIdentity`.

A Guest session cannot be read or mutated by another GuestIdentity.

The server remains authoritative for:

- game definition/version;
- seed;
- initial state;
- current state;
- state hash;
- action sequence;
- question generation;
- answer validation;
- score;
- completion;
- result.

The client supplies only the allowed action type, strict action payload, expected sequence and idempotency key.

No client score, winner, reward, rating, leaderboard entry or economy value is accepted.

## Idempotency and concurrency

Creation is unique on `(guestId, creationKey)`.

Actions are protected by:

- expected sequence;
- state hash integrity verification;
- serializable transaction;
- compare-and-update on session sequence;
- unique action sequence;
- unique `(sessionId, guestId, idempotencyKey)` action/receipt boundaries.

Retrying the same accepted action does not apply it twice.

## Guest eligibility

Only `quick-math` is allowlisted in this delivery.

Pulse Duel, Affinity Mirror and future unknown games remain unavailable to Guest gameplay unless a later KMD explicitly reviews and allowlists them.

`GET /games/guest` now returns Quick Math and `GuestPlayService.policy().supportsGameplay` becomes true only because a complete bounded lifecycle exists.

## Expiry and account conversion

A Guest game session:

- expires after at most 30 minutes;
- can never outlive its GuestIdentity;
- becomes unusable once the GuestIdentity is revoked, blocked, expired or converted.

Guest -> account conversion still reports `conversionTransfersGameplayData: false`.

KMD-197 does not migrate scores, achievements, rewards or history into the new account. That transfer requires a separate privacy/data-model review.

## Data minimization

Public game views do not expose:

- Guest token hash;
- raw Guest credential;
- game seed;
- account user ID;
- private account relationships;
- internal persistence metadata not required for play.

## Tests

The PostgreSQL E2E suite verifies:

- Guest policy now truthfully reports bounded gameplay support;
- Quick Math is the only Guest-catalog game;
- session creation without an account;
- server-held seed and expiry boundary;
- seed/token-hash non-disclosure;
- START and all five ANSWER actions;
- deterministic server score/result;
- action idempotency;
- persisted action count without duplicate replay;
- cross-Guest session isolation;
- fail-closed denial of Pulse Duel Guest creation.

Existing engine unit tests continue to cover deterministic question generation, strict answer payloads and client score injection rejection.

## Migration

No new Prisma migration is required. KMD-195 already introduced all Guest gameplay tables and indexes.

## Rollback

If KMD-197 must be disabled after merge:

1. set Quick Math `guestEligible` back to false in a forward change;
2. set the public Guest gameplay policy to false;
3. remove/disable the Guest gameplay routes and service provider;
4. preserve existing Guest gameplay rows until normal Guest retention purge removes them;
5. do not rewrite `quick-math@1` or delete historical state needed for diagnosis.

No account-bound game schema rollback is required.

## Evidence not claimed

KMD-197 does not prove:

- Web Instant Game UI;
- Mobile Guest UI;
- physical-device behavior;
- offline play;
- low-bandwidth performance targets;
- Guest -> account gameplay migration;
- ranked/rewarded Guest play;
- anti-bot guarantees suitable for economic rewards;
- production deployment or store approval.

Those remain later deliveries or external validations.
