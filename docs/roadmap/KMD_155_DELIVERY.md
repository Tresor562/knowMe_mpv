# KMD-155 — Web challenges authority fail-closed

## Scope

KnowMe core Web only.

KMD-155 hardens the authenticated Web challenges surface so challenge cards and challenge mutations cannot remain visible or actionable across authority refresh failures or authenticated identity changes.

## Behavior

- The active authenticated `user.id` scopes challenge loading.
- Challenge cards and creator state are cleared before each authority refresh.
- Challenge loads are generation-scoped so superseded late responses cannot republish stale data.
- Creating or joining a challenge requires freshly validated challenge authority.
- A failed create/join mutation invalidates the rendered challenge authority until a successful reload.
- Empty-state and challenge cards render only after `/challenges` has loaded successfully for the current identity.
- Concurrent challenge mutations are blocked by the local busy guard.

## Authority and safety boundaries

- Existing `/challenges` and `/challenges/:id/join` routes remain authoritative.
- No new endpoint or API contract.
- No schema or persistence change.
- No migration.
- No role, membership, authorization, entitlement, Premium, KnowCoins, call, device, hardware, legal, or OS-permission change.
- No Nexus core or Nexus × KnowMe integration change.
- No KMD-059 change.

## Validation

KMD-155 must remain unmerged until repository CI is fully green:

- Prisma client generation and schema push;
- complete monorepo build, including Next.js Web;
- complete unit suite;
- PostgreSQL API E2E suite;
- any existing Web/Playwright checks executed by CI;
- focused diff review confirming stale challenge authority cannot remain visible or actionable after refresh, mutation failure, or identity change.

The Web package currently has no dedicated React component test runner for this page. The adapted gate is therefore TypeScript/Next.js compilation, repository automated suites, and focused diff review.

Diff review must confirm that:

1. previous challenge cards and creator state are cleared before new authority is accepted;
2. late challenge-load responses cannot republish stale state;
3. create and join actions are unavailable when authority is not fresh;
4. failed challenge mutations invalidate current authority;
5. no API, database, Nexus, call, hardware, legal, or KMD-059 code is changed.

## Migration

None.

## Rollback

Restore `apps/web/app/challenges/page.tsx` to its pre-KMD-155 behavior and remove this delivery document. No database rollback is required.
