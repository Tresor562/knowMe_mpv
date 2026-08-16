# KMD-094 — Web personal conversation pins

## Scope

KMD-094 exposes the merged KMD-093 authoritative private conversation-pin contract in the Web product.

- authenticated `/conversation-pins` experience;
- lists only pins returned by the server-authoritative KMD-093 endpoint;
- resolves labels only from conversations the current user can already access;
- pins and unpins through the KMD-093 API;
- presents the fixed five-pin product limit without attempting to override the server;
- opens only already-accessible conversations;
- adds an entry point from the Web messages page.

## Authority and privacy boundaries

A pin remains a personal reference, never an authorization decision. The client does not infer membership, restore inaccessible conversations, mutate members, change roles, alter notification policy, or persist a second pin store.

KMD-094 does not modify Nexus integration, Premium, KnowCoins, KMD-059, archives, folders, device permissions, or any hardware flow.

## Validation

Before merge:

1. the standard monorepo build, including the Next.js production build, must pass;
2. the complete unit suite must remain green;
3. the PostgreSQL-backed API E2E suite must remain green;
4. KMD-093 remains the server source of truth for membership validation, stale-reference cleanup, idempotence, concurrency serialization, and the five-pin limit.

## Rollback

Remove the `/conversation-pins` Web route and its `/messages` entry point. No database rollback is required because this milestone adds no persistence or migration; the KMD-093 API and stored pins remain intact.
