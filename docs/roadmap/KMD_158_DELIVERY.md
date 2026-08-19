# KMD-158 — Web profile circles authority fail-closed

## Scope

KnowMe core Web only.

KMD-158 hardens the authenticated profile-circles management surface so stale memberships, capabilities, join requests, or lifecycle controls cannot remain visible or actionable across identity changes, failed reloads, failed mutations, or superseded responses.

## Behavior

- The active authenticated `user.id` scopes circle authority.
- Circle entries and loaded join requests are cleared before each authority refresh.
- Loads are generation-scoped so superseded late responses cannot republish stale circle data.
- Circle cards and empty states render only after `/profile-circles/me` succeeds for the current identity.
- Membership, lifecycle, join-request, and review mutations require fresh authority and block concurrent mutations.
- Failed mutations invalidate rendered authority until a successful reload.

## Authority and safety boundaries

- Existing profile-circle routes remain authoritative.
- No new endpoint or API contract.
- No schema or persistence change.
- No migration.
- No role, membership, consent, visibility, authorization, entitlement, Premium, KnowCoins, call, device, hardware, legal, or OS-permission change.
- No Nexus core or Nexus × KnowMe integration change.
- No KMD-059 change.

## Validation

KMD-158 must remain unmerged until repository CI is fully green:

- Prisma client generation and schema push;
- complete monorepo build including Next.js Web;
- complete unit suite;
- PostgreSQL API E2E suite;
- any existing Web/Playwright checks executed by CI;
- focused diff review confirming stale profile-circle authority cannot remain visible or actionable after identity changes, refresh failures, or mutation failures.

The Web package currently has no dedicated React component runner for this page. The adapted gate is TypeScript/Next.js compilation, repository automated suites, and focused diff review.

## Migration

None.

## Rollback

Restore `apps/web/app/profile-circles/page.tsx` to its pre-KMD-158 behavior and remove this delivery document. No database rollback is required.
