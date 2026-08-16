# KMD-099 — Mobile authoritative conversation-pin capacity

## Scope

KMD-099 removes the remaining Mobile-side fallback conversation-pin capacity from the personal pin manager introduced by KMD-095.

- the Mobile client reads `limit` from the authoritative `GET /conversation-pins` response;
- the displayed usage counter derives from that server-provided limit;
- the add-pin action stays disabled until the authoritative capacity is known;
- the limit-reached explanation uses the same server-provided value;
- the Mobile client no longer authors or falls back to a numeric pin capacity.

## Authority and privacy boundaries

The API remains the sole authority for the pin limit and still enforces it transactionally. This change does not weaken the server-side KMD-093 guard, create local persistence, grant conversation access, or modify membership, roles, notifications, archives, folders, Premium, KnowCoins, Nexus integration, hardware/device behavior, or KMD-059.

## Validation

Before merge:

1. the complete monorepo build must pass, including strict Mobile TypeScript compilation;
2. the complete existing unit suite must remain green;
3. PostgreSQL-backed API E2E must remain green, including KMD-093 limit/concurrency and authorization coverage;
4. the Mobile pin manager must not contain a client-authored numeric pin capacity;
5. no database or client-storage migration may be introduced.

## Migration

No migration is required. KMD-099 changes only Mobile presentation/guarding and consumes the existing KMD-093 response contract.

## Rollback

Revert the KMD-099 Mobile change and remove this document. No database rollback is required and existing private pins remain intact.
