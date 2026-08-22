# KMD-187 — Persistent game favorites

## Phase

Play for Everyone — Game Center V2.

## Goal

Allow authenticated players to keep a private, durable list of favorite games without changing the public catalog, game authority, scoring, matchmaking, economy, or social graph.

## Delivered

- persistent `GameFavorite` records keyed by `(userId, definitionKey)`;
- safe migration with supporting indexes;
- `GET /games/favorites` for the authenticated account only;
- idempotent `POST /games/:key/favorite`;
- idempotent `DELETE /games/:key/favorite`;
- favorites can only be created for games currently present in the public active catalog;
- retired/unavailable games are not returned by the favorites projection;
- favorites are included in the authenticated account export under `gamePlatform.favorites`, including for an account that has not yet created a game session;
- the account export format advances to version 20 when favorite data is present;
- account deletion removes favorites before the rest of game lifecycle cleanup;
- unit and PostgreSQL E2E coverage for idempotency, stale catalog entries, account isolation, export and erasure.

## Privacy and authority boundaries

Favorites are private account preference data. They are never used to grant permissions, staff status, Premium entitlement, economic rewards, matchmaking priority or leaderboard position. The public Game Center remains readable without authentication, while favorites require JWT authentication and are always scoped to `req.user.userId`.

Account export remains protected by the existing sensitive-action guard. The export contains only the favorite game definition key and creation timestamp for the requesting account; it does not expose another account's favorites.

No score, winner, rating, game state or economic value is accepted from the favorite endpoints.

## Data retention

A favorite remains until the user removes it or deletes the account. If a game is retired, the stored row may remain temporarily for referential product history but is hidden from the active favorites projection, remains exportable as the user's retained preference record, and is erased with account deletion.

## Validation gate

Before merge, the exact PR head must pass:

1. dependency installation and production dependency audit;
2. Prisma client generation;
3. `prisma migrate deploy` against clean PostgreSQL 16;
4. migration/datamodel zero-drift check;
5. complete monorepo build;
6. unit tests including the new favorites and account-erasure coverage;
7. Chromium Web E2E;
8. PostgreSQL API E2E, including private account export isolation.

## Rollback

Application rollback: revert the KMD-187 application changes. The additive `GameFavorite` table can safely remain unused during an emergency application rollback.

Schema rollback, if explicitly required after confirming no release depends on the data: drop `GameFavorite` and its indexes in a reviewed forward migration. Do not automatically reverse production migrations during application rollback.

## Follow-up

The next Game Center work can consume this private preference data for a real `Mes jeux` surface and later combine it with recent sessions for `Continue Playing`. Guest Play remains a separate security and identity boundary and is not introduced here.
