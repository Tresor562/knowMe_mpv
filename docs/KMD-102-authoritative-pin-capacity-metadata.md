# KMD-102 — Authoritative conversation-pin capacity metadata

## Scope

Expose capacity metadata from the existing authenticated `GET /conversation-pins` authority so clients do not need to infer whether another pin can be added from a duplicated numeric rule.

The response remains backward compatible and now includes:

- `limit`: the existing server-owned maximum;
- `remaining`: the number of additional currently accessible conversations that may be pinned before reaching the bound;
- `canPinMore`: `true` only when `remaining > 0`;
- `items`: the caller's currently accessible pins.

Stale pins are removed before `remaining` and `canPinMore` are calculated. A stale pin therefore cannot consume client-visible capacity or become an authorization signal.

## Authority and safety

KMD-093 remains the sole persistence, membership, idempotency and concurrency authority. The serialized pin mutation still enforces the bounded limit transactionally. KMD-102 does not widen access, add permissions, change membership semantics or move authority to Web/Mobile.

This is KnowMe core only. It contains no Nexus, Premium, KnowCoins, device/hardware or KMD-059 work.

## Validation

The standard repository CI must pass before merge, including Prisma generation/schema push, monorepo build, complete unit suite and PostgreSQL API E2E.

Unit coverage specifically verifies that:

1. stale inaccessible pins are cleaned before capacity is derived;
2. one accessible pin produces `remaining = 4` and `canPinMore = true`;
3. five accessible pins produce `remaining = 0` and `canPinMore = false`;
4. membership rejection, idempotency and transactional five-pin enforcement remain unchanged.

## Migration

No schema or data migration is required. The change is an additive response contract only.

## Rollback

Revert the KMD-102 service/test/documentation commits. Existing clients that only consume `limit` and `items` remain compatible, and no data rollback is required.
