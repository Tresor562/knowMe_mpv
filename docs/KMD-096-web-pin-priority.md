# KMD-096 — Web pinned conversation priority

## Scope

KMD-096 consumes the merged KMD-093 authoritative private conversation-pin contract directly in the existing Web Messages surface.

- loads the current user's server-authoritative pin set with the normal conversation list;
- keeps pinned conversations ahead of unpinned conversations while preserving the existing relative recency order inside each group;
- marks pinned rows explicitly in the Messages list;
- refreshes the pin projection whenever the existing Messages refresh path runs.

## Authority and privacy boundaries

The Web client does not create a second pin store or infer pin state from local behavior. A pin remains a private presentation preference and never grants conversation access. The authoritative `/conversation-pins` endpoint already removes stale references that are no longer backed by membership.

KMD-096 does not change Nexus integration, Premium, KnowCoins, KMD-059, notification policy, memberships, roles, archives, folders, device permissions, camera/microphone behavior, or persistence.

## Validation

Before merge:

1. the complete monorepo build must pass, including the production Next.js build;
2. the complete existing unit suite must remain green;
3. PostgreSQL-backed API E2E must remain green, preserving KMD-093 authorization and stale-reference cleanup;
4. the Messages surface must continue to derive pin state only from the authoritative KMD-093 API;
5. no new client persistence, authorization path, or database migration may be introduced.

The ordering change is intentionally presentation-only, so no schema migration is required. The standard CI build is the adapted regression gate for the changed Web surface, while the existing KMD-093 API tests remain the authority/security gate.

## Rollback

Revert the KMD-096 changes in `apps/web/app/messages/page.tsx` and remove this delivery document. No database rollback is required; KMD-093 and stored private pins remain intact.
