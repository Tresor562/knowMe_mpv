# KMD-196 — Deterministic Quick Math engine

## Status

Implementation branch. Do not treat this delivery as merged or public Guest Play until its exact head passes the repository merge gate.

## Purpose

Introduce the first new solo engine in the Play for Everyone expansion with a deliberately narrow, server-authoritative contract that can later be connected to the dedicated Guest gameplay persistence boundary delivered in KMD-195.

KMD-196 does **not** expose Guest gameplay endpoints. It qualifies the engine layer first so that session/action transport can be added without mixing engine correctness, persistence authority and public API rollout in one risky change.

## Delivered scope

- adds `QuickMathEngine` (`QUICK_MATH_V1`);
- adds immutable `quick-math@1` game definition;
- requires exactly one player;
- starts from an explicit `START` action;
- generates five deterministic arithmetic questions from the server-held session seed and round number;
- accepts only a single integer `answer` field from the client;
- computes correctness, score, progression and completion on the server;
- rejects client-supplied score/winner/economy fields by strict payload shape;
- exposes only the current question and previous resolved outcome in public state;
- registers the engine and definition in `GameEngineRegistry`;
- publishes Quick Math in Game Center as a short `solo` / `instant` / `brain` game;
- keeps `guestEligible: false` until Guest session/action endpoints exist and are E2E validated.

## Authority and safety boundaries

The client is never authoritative for:

- generated question;
- expected answer;
- score;
- winner;
- completion;
- reward;
- rating;
- leaderboard;
- economy.

The current question is derived deterministically from the session seed and round. The seed itself is not included in the public projection.

There is no timing-based score in this version. This is intentional: network latency and client clocks would make a reaction-time score unfair and easier to manipulate. A future reaction game must define a separate authoritative timing protocol before ranked or reward-bearing use.

## Guest Play boundary

KMD-195 provides dedicated Guest session/action persistence primitives. KMD-196 provides a deterministic solo engine suitable for that boundary, but **does not** connect them yet.

Therefore:

- `GET /games/guest` remains fail-closed;
- `GuestPlayService.policy().supportsGameplay` remains false;
- no Guest session creation endpoint exists for Quick Math;
- no Guest action endpoint exists for Quick Math;
- no guest score/achievement/reward migration is claimed.

The next delivery should connect one explicitly allowlisted engine to Guest session creation and idempotent authoritative actions, then validate that lifecycle in PostgreSQL E2E before changing `guestEligible` or `supportsGameplay`.

## Tests

Unit coverage verifies:

- one-player constraint;
- deterministic question generation;
- explicit start lifecycle;
- rejection of client score injection;
- server-only score computation across all five rounds;
- invalid actor rejection;
- duplicate start rejection;
- answer-before-start rejection;
- seed non-disclosure in public state.

Game Center PostgreSQL E2E also verifies that `quick-math` is catalogued as a solo game while the public Guest catalog remains disabled.

## Migration

No Prisma schema change is required in KMD-196. KMD-195 already introduced the persistence primitives needed by the upcoming Guest lifecycle.

The game definition is synchronized through the existing immutable `GameEngineRegistry` catalog mechanism. Once `quick-math@1` exists in a database, its checksum must not be silently changed. Any rule change requires a new game version.

## Rollback

Before merge: close the PR and delete the feature branch if appropriate.

After merge but before public gameplay use: disable or remove the Quick Math definition from a subsequent forward change rather than mutating `quick-math@1` in place.

If sessions exist in the future, preserve the engine/version required for replay and historical determinism. Never rewrite an already-used immutable definition.

## Evidence not claimed

KMD-196 does not prove:

- physical Web/iOS/Android playability;
- Guest Play public usability;
- offline behavior;
- low-bandwidth performance;
- store approval;
- legal review;
- production deployment;
- anti-bot protection for ranked/rewarded play;
- external monitoring of game errors.

Those require later implementation or real deployment evidence.
