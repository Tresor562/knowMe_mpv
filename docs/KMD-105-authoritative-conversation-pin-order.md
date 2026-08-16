# KMD-105 — Authoritative conversation-pin ordering

## Scope

Adds a server-owned personal ordering for the caller's existing conversation pins.

- `ConversationPin.position` persists ordering without duplicating conversation content.
- `GET /conversation-pins` returns pins in authoritative position order.
- `PUT /conversation-pins/order` accepts the complete current pin set as `conversationIds` in desired top-to-bottom order.
- A newly pinned conversation receives the next highest position, preserving the existing newest-pin-first behavior.
- Reordering is serialized per user with the same database user lock used by pin creation.

## Authority and safety

A pin remains personal organization metadata and never grants conversation access. Reorder accepts only conversations for which the caller currently has membership and only when the submitted IDs exactly match the caller's current persisted pin set. Duplicate, oversized, inaccessible and stale sets fail closed; partial reorder is not accepted.

KMD-093 remains the membership, bounded-capacity, idempotency and persistence authority. KMD-102 remains the capacity metadata authority. This KMD does not change roles, notifications, archives, folders, Premium, KnowCoins, Nexus, devices or KMD-059.

## Migration

The migration adds a non-null integer `position` with a safe default, backfills each user's existing pins deterministically from oldest to newest `pinnedAt` so the newest keeps the highest position, and adds an index on `(userId, position)`. Existing `pinnedAt` data is retained.

## Validation

Before merge the standard CI must pass:

1. Prisma client generation and PostgreSQL schema push;
2. complete monorepo build;
3. complete unit suite, including new pin positioning and reorder validation;
4. PostgreSQL-backed API E2E suite;
5. no unresolved review/security blockers.

Unit coverage specifically proves exact-set reorder, serialization, inaccessible-target rejection, duplicate/oversized rejection, stale-set conflict, capacity enforcement and idempotent pin creation.

## Rollback

1. Stop clients from calling `PUT /conversation-pins/order`.
2. Revert the service/controller behavior to `pinnedAt` ordering and pin creation without `position`.
3. Drop index `ConversationPin_userId_position_idx`.
4. Drop column `ConversationPin.position`.

No conversation, membership or message data is modified by this rollback. The pre-KMD-105 order remains recoverable from `pinnedAt`.
