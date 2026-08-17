# KMD-112 — Required optimistic conversation-pin baseline

## Scope

KnowMe core only. This milestone hardens the existing conversation-pin reorder HTTP contract after KMD-110 and KMD-111 adopted KMD-109 on both first-party clients.

## Contract

`PUT /conversation-pins/order` now requires both:

- `conversationIds`: the complete desired authoritative order;
- `expectedConversationIds`: the complete authoritative order observed by the client before the mutation.

Missing or malformed `expectedConversationIds` fails closed with HTTP 400 before the service mutates state. The service still performs the KMD-109 comparison under the serialized user transaction and returns `409 CONVERSATION_PIN_ORDER_STALE` when the observed order no longer matches.

The lower service layer keeps the optional argument for internal compatibility; the authenticated HTTP boundary is authoritative for first-party Web/Mobile traffic and now rejects legacy reorder payloads.

## Safety and authority

- no client-provided arbitrary positions;
- no bypass of conversation membership checks;
- no partial reorder;
- stale sessions cannot silently overwrite a newer order;
- no Nexus core or Nexus × KnowMe integration change;
- no KMD-059, calls, Premium, KnowCoins, hardware, legal or permission change.

## Validation

Standard CI must pass before merge:

1. Prisma generation and PostgreSQL schema push;
2. monorepo build, including Web and Mobile TypeScript validation;
3. full unit suite, including the KMD-112 controller contract tests and KMD-109 concurrency tests;
4. PostgreSQL API E2E;
5. no unresolved review/security blocker.

## Migration

No database migration is required. KMD-112 changes request validation only and reuses the KMD-105/KMD-109 persisted ordering model.

## Rollback

Revert the KMD-112 controller validation and its tests/documentation. The service remains compatible with the prior optional KMD-109 baseline, so rollback requires no data migration or schema change.
