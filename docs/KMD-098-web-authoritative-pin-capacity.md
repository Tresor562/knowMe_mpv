# KMD-098 — Web authoritative conversation-pin capacity

## Scope

KMD-098 removes the remaining Web-side hard-coded conversation-pin capacity from the personal pin manager introduced by KMD-094.

- the Web client reads `limit` from the authoritative `GET /conversation-pins` response;
- the displayed usage counter derives from that server-provided limit;
- the add-pin action stays disabled until the authoritative capacity is known;
- the limit-reached explanation uses the same server-provided value.

## Authority and privacy boundaries

The API remains the sole authority for the pin limit and still enforces it transactionally. This change does not weaken the server-side KMD-093 guard, create local persistence, grant conversation access, or modify membership, roles, notifications, archives, folders, Premium, KnowCoins, Nexus integration, hardware/device behavior, or KMD-059.

## Validation

Before merge:

1. the production Web build must pass;
2. the complete unit suite must remain green;
3. PostgreSQL-backed API E2E must remain green, including KMD-093 limit/concurrency and authorization coverage;
4. the Web pin manager must not contain a client-authored numeric pin capacity;
5. no database or client-storage migration may be introduced.

## Migration

No migration is required. KMD-098 changes only Web presentation/guarding and consumes the existing KMD-093 response contract.

## Rollback

Revert the KMD-098 Web change and remove this document. No database rollback is required and existing private pins remain intact.
