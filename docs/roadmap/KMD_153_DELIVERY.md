# KMD-153 — Web friends authority fail-closed

## Scope

KnowMe core Web only.

KMD-153 hardens the authenticated Web friends surface so stale friendship, incoming request, and search-result state cannot remain visible or actionable across authority refresh failures or authenticated identity changes.

## Behavior

- The current authenticated session identity from `useSession` scopes social-data loading.
- Friendship and incoming-request state is cleared before each authority refresh.
- Search results are invalidated when the authenticated identity changes or social authority becomes stale.
- Social loads are generation-scoped so a late response from an older load cannot overwrite newer authority.
- Search, accept/decline, remove-friend, and add-friend actions require freshly validated social authority.
- A failed relationship mutation invalidates the currently rendered social authority until a successful reload.
- Empty-state counts and cards are rendered only after the required friendship authorities have loaded successfully.

## Authority and safety boundaries

- Existing `/social/friend-requests/incoming`, `/social/friends`, `/social/search`, and existing mutation routes remain authoritative.
- No new endpoint or API contract.
- No schema or persistence change.
- No migration.
- No role, membership, authorization, entitlement, Premium, KnowCoins, call, device, hardware, legal, or OS-permission change.
- No Nexus core or Nexus × KnowMe integration change.
- No KMD-059 change.

## Validation

KMD-153 must remain unmerged until repository CI is fully green:

- Prisma client generation and schema push;
- complete monorepo build, including Next.js Web;
- complete unit suite;
- PostgreSQL API E2E suite;
- any existing Web/Playwright checks executed by CI;
- diff review confirming stale authority cannot remain actionable after refresh or identity change.

The Web package currently has no dedicated React component test runner for this page. The adapted gate is therefore TypeScript/Next.js compilation, repository automated suites, and focused diff review.

Diff review must confirm that:

1. previous friends, requests, and search results are cleared before new authority is accepted;
2. late social-load responses cannot republish stale state;
3. mutations and search are disabled when authority is not fresh;
4. failed relationship mutations invalidate current social authority;
5. no API, database, Nexus, call, hardware, or KMD-059 code is changed.

## Migration

None.

## Rollback

Restore `apps/web/app/friends/page.tsx` to its pre-KMD-153 behavior and remove this delivery document. No database rollback is required.
