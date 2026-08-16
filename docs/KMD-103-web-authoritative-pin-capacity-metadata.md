# KMD-103 — Web authoritative conversation-pin capacity metadata

## Scope

Consume the KMD-102 server-authored `remaining` and `canPinMore` fields in the existing Web conversation-pin management surface.

The Web client no longer derives whether another pin can be added from `items.length >= limit`. It now treats the API response as the authority for:

- the maximum `limit`;
- the remaining capacity `remaining`;
- whether another pin can be added through `canPinMore`.

If capacity metadata is unavailable, adding a pin fails closed in the UI. Removing an existing pin remains available because it cannot increase authority or exceed the bounded server limit.

## Boundaries

This is KnowMe core Web only. KMD-093 remains the persistence, membership, idempotency and concurrency authority and KMD-102 remains the capacity-metadata authority.

No schema, migration, permission, membership, role, Nexus, Premium, KnowCoins, device or KMD-059 behavior changes are introduced.

## Validation

Before merge, the standard repository CI must pass, including:

1. Prisma client generation and PostgreSQL schema push;
2. complete monorepo build, including strict Web TypeScript compilation;
3. complete unit test suite;
4. PostgreSQL-backed API E2E.

The Web build is the relevant regression gate for the additive response contract consumed here. Existing API unit coverage in KMD-102 verifies stale cleanup, `remaining`, `canPinMore`, membership and transactional pin-limit enforcement.

## Migration

No database or data migration is required.

## Rollback

Revert the KMD-103 Web and documentation commits. The server can continue returning KMD-102 metadata because the response is additive and older clients remain compatible.
