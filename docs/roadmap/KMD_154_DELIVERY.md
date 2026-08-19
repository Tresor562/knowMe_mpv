# KMD-154 — Web feed authority fail-closed

## Scope

KnowMe core Web only.

KMD-154 hardens the authenticated Web feed so stale posts and actions cannot remain visible or actionable across authority refresh failures or authenticated identity changes.

## Behavior

- The active authenticated `user.id` scopes feed loading.
- Feed posts and pagination state are cleared before each authority refresh.
- Feed loads are generation-scoped so superseded late responses cannot republish stale data.
- Publish, like and pagination actions require freshly validated feed authority.
- A failed publish, like or pagination request invalidates the currently rendered feed authority until a successful reload.
- Empty-state and post cards are rendered only after `/posts/feed` has loaded successfully for the current identity.

## Authority and safety boundaries

- Existing `/posts/feed`, `/posts`, and `/posts/:id/like` routes remain authoritative.
- No new endpoint or API contract.
- No schema or persistence change.
- No migration.
- No role, membership, authorization, entitlement, Premium, KnowCoins, call, device, hardware, legal, or OS-permission change.
- No Nexus core or Nexus × KnowMe integration change.
- No KMD-059 change.

## Validation

KMD-154 must remain unmerged until repository CI is fully green:

- Prisma client generation and schema push;
- complete monorepo build, including Next.js Web;
- complete unit suite;
- PostgreSQL API E2E suite;
- any existing Web/Playwright checks executed by CI;
- focused diff review confirming stale feed authority cannot remain visible or actionable after refresh, mutation failure, or identity change.

The Web package currently has no dedicated React component test runner for this page. The adapted gate is therefore TypeScript/Next.js compilation, repository automated suites, and focused diff review.

Diff review must confirm that:

1. previous posts and pagination state are cleared before new authority is accepted;
2. late feed-load responses cannot republish stale state;
3. publish, like, and pagination actions are unavailable when authority is not fresh;
4. failed mutations invalidate current feed authority;
5. no API, database, Nexus, call, hardware, legal, or KMD-059 code is changed.

## Migration

None.

## Rollback

Restore `apps/web/app/feed/page.tsx` to its pre-KMD-154 behavior and remove this delivery document. No database rollback is required.
