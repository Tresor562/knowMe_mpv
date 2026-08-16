# KMD-097 — Mobile pinned conversation priority

## Scope

KMD-097 consumes the merged KMD-093 authoritative private conversation-pin contract in the existing Mobile realtime messaging surface.

- loads the caller's authoritative pin set alongside conversations and friends;
- places pinned conversations before unpinned conversations while preserving the existing relative recency order inside each group;
- marks pinned rows explicitly in the Mobile conversation list;
- refreshes the projection through the existing Mobile refresh path.

## Authority and privacy boundaries

The Mobile client does not create a second pin store and does not infer pin state from local behavior. Pin state comes only from `GET /conversation-pins`, whose server-side membership revalidation and stale-reference cleanup remain authoritative.

KMD-097 changes no membership, role, notification, archive, folder, Premium, KnowCoins, Nexus integration, hardware/device flow, or KMD-059 behavior.

## Validation

Before merge:

1. strict Mobile TypeScript compilation must pass as part of the monorepo build;
2. the complete unit suite must remain green;
3. PostgreSQL-backed API E2E must remain green, preserving KMD-093 authorization, pin limit, concurrency, and stale-reference cleanup;
4. the Mobile Messages surface must derive pin state only from the authoritative KMD-093 API;
5. no client persistence, authorization path, or database migration may be introduced.

There is no Mobile-local test runner in `@knowme/mobile`; therefore the adapted UI regression gate for this presentation-only change is strict TypeScript compilation in the standard CI, while the existing KMD-093 API tests remain the authority/security gate.

## Migration

No database or client-storage migration is required. KMD-097 reuses KMD-093 persistence unchanged.

## Rollback

Revert the KMD-097 changes in `apps/mobile/src/RealtimeMessagesPanel.tsx` and remove this delivery document. No database rollback is required; KMD-093 stored private pins remain intact.