# KMD-186 — Game Center V2 catalog baseline

## Goal

Start the Play for Everyone roadmap from the first free KMD after KMD-185 by turning the existing authoritative game registry into a discoverable public Game Center surface.

This block deliberately builds on the existing Game Platform. It does not recreate session, replay, scoring, idempotency, or authoritative-server infrastructure.

## Delivered

- `GET /games/center` public catalog projection for immediate discovery before authentication.
- Optional `q` text search and `category` filtering.
- `GET /games/categories` with stable product-facing taxonomy and live counts.
- Product metadata for category, mode, estimated session length and future guest eligibility.
- Existing security/economic guarantees remain explicit: authoritative server, replay availability, and no economic stake.
- No account is required to browse or search the Game Center.

## Product boundary

KMD-186 is Phase 1 groundwork, not Guest Play itself. `guestEligible` remains `false` for the current games until a dedicated guest identity/token boundary exists. Session creation and participation continue to require authenticated users.

No fake Trending, Recommended, Ranked, Daily, AI, or popularity signal is exposed. Those surfaces require real data and dedicated KMDs.

## Validation gate

Before merge, the exact PR head must pass the repository gate:

1. dependency install and production dependency audit;
2. Prisma generation;
3. migration deploy on clean PostgreSQL 16;
4. zero-drift check;
5. complete monorepo build;
6. unit tests;
7. Chromium Web E2E;
8. PostgreSQL API E2E, including the new public Game Center tests.

## Privacy and safety

The public catalog contains game-definition/product metadata only. It does not expose users, sessions, invitations, scores, contacts, activity history, recommendations, or private social data.

Search is deterministic substring matching over public game metadata. No sensitive behavioral profiling is introduced in this block.

## Rollback

Remove `GameCatalogController` and `GameCatalogService` registration and the two public routes. The existing `/games/catalog` and authenticated Game Platform remain intact, so rollback does not require data migration.

## Next logical blocks

Continue the Play for Everyone roadmap without forcing social usage:

- favorites / recently played / Continue Playing;
- Game Center Web and Mobile UI backed by real APIs;
- GuestIdentity + signed guest session boundary;
- Web Instant Games;
- first deterministic solo games and Daily.

Each must receive its own free KMD after checking live `main`, branches, PRs and CI.
