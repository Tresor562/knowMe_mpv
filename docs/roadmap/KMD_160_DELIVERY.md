# KMD-160 — Web achievements authority fail-closed

## Scope

KnowMe core Web only.

KMD-160 hardens the authenticated merits surface so stale badges, titles, title-selection state, or trust-rule output cannot remain visible or actionable across identity changes, failed reloads, failed mutations, or superseded responses.

## Behavior

- The active authenticated `user.id` scopes achievement authority.
- Achievement summary state is cleared before every authority refresh.
- Loads are generation-scoped so superseded late responses cannot republish stale merit state.
- Merit cards, empty states, selected-title state, and trust-rule content render only after `/achievements/me` succeeds for the current identity.
- Title selection/removal requires fresh authority and blocks concurrent mutations.
- A failed title mutation invalidates rendered authority until a successful reload.

## Authority and safety boundaries

- Existing achievement routes remain authoritative.
- No new endpoint or API contract.
- No schema or persistence change.
- No migration.
- No role, merit-generation rule, verification, staff, Premium, KnowCoins, authorization, entitlement, call, device, hardware, legal, or OS-permission change.
- No Nexus core or Nexus × KnowMe integration change.
- No KMD-059 change.

## Validation

KMD-160 must remain unmerged until repository CI is fully green:

- Prisma client generation and schema push;
- complete monorepo build including Next.js Web;
- complete unit suite;
- PostgreSQL API E2E suite;
- any existing Web/Playwright checks executed by CI;
- focused diff review confirming stale merit authority cannot remain visible or actionable after identity changes, refresh failures, or title-mutation failures.

The Web package currently has no dedicated React component runner for this page. The adapted gate is TypeScript/Next.js compilation, repository automated suites, and focused diff review.

## Migration

None.

## Rollback

Restore `apps/web/app/achievements/page.tsx` to its pre-KMD-160 behavior and remove this delivery document. No database rollback is required.
