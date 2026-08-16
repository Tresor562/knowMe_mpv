# KMD-095 — Mobile personal conversation pins

## Scope

KMD-095 consumes the merged KMD-093 authoritative private conversation-pin contract in the Mobile product.

- exposes a reusable authenticated Mobile conversation-pins experience;
- lists only pins returned by the server-authoritative KMD-093 endpoint;
- resolves labels only from conversations the current user can already access;
- pins and unpins through the KMD-093 API;
- reads the server-provided pin limit when available and falls back only for presentation;
- opens a conversation only through an optional callback supplied by an already-authorized parent flow.

## Authority and privacy boundaries

A pin is a personal reference, never an authorization decision. The Mobile client does not infer membership, restore inaccessible conversations, mutate members, change roles, alter notification policy, or persist a second pin store.

KMD-095 does not modify Nexus integration, Premium, KnowCoins, KMD-059, archives, folders, device permissions, camera/microphone behavior, or any hardware flow.

## Validation

Before merge:

1. the complete monorepo build must pass, including strict Mobile TypeScript compilation;
2. the complete existing unit suite must remain green;
3. the PostgreSQL-backed API E2E suite must remain green, preserving KMD-093 authorization, stale-reference cleanup, idempotence, concurrency serialization and the authoritative pin limit;
4. the Mobile experience must not add local persistence, new permissions, or a second authorization path.

No new database migration is required because KMD-095 reuses the merged KMD-093 persistence and API.

## Rollback

Remove `apps/mobile/src/ConversationPinsExperience.tsx` and any later navigation entry point that imports it. No database rollback is required; KMD-093 and stored private pins remain intact.
