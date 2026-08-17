# KMD-108 — Contiguous authoritative conversation-pin order

## Scope

KnowMe core only. This milestone strengthens the server-owned `ConversationPin.position` invariant introduced by KMD-105.

When a pin is removed, or when `GET /conversation-pins` removes a stale pin because the caller no longer belongs to that conversation, the API now compacts every surviving pin to a contiguous position set under the same per-user row lock used by pin-order mutations.

For `n` surviving pins, authoritative positions are exactly `n - 1 ... 0` in the existing display order. This prevents a later pin, whose position is derived from the current count, from colliding with a surviving position after a middle item was removed.

## Authority and safety

- Pin order remains server-owned.
- Membership remains the access authority; a pin never grants conversation access.
- Stale-pin cleanup still fails closed by deleting inaccessible pin metadata.
- Unpin remains idempotent.
- Compaction is serialized on the user row before deletion/order repair, avoiding overlapping per-user pin mutations.
- No client-provided position is accepted.
- No Nexus core, Nexus × KnowMe integration, Premium, KnowCoins, call/device, or KMD-059 behavior changes.

## Persistence / migration

No schema migration is required. KMD-105 already introduced `ConversationPin.position`. KMD-108 only repairs and maintains its runtime invariant.

Existing KMD-105 backfill produced deterministic positions. Any gap created after that rollout is repaired the next time a stale pin is cleaned or an explicit unpin succeeds.

## Validation

Standard repository CI must be fully green before merge:

1. Prisma generation and PostgreSQL schema push.
2. Complete monorepo build.
3. Complete unit suite, including KMD-108 cases for stale cleanup, middle-item removal, idempotent unpin and compaction.
4. PostgreSQL-backed API E2E suite.
5. No unresolved review or security blocker.

## Rollback

Revert the KMD-108 service/test/documentation commit(s). No down migration is needed because the schema is unchanged. Positions already compacted remain valid KMD-105 positions after rollback; rollback does not require reconstructing prior gaps.
