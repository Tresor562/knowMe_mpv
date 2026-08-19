# KMD-156 — Web public profile authority fail-closed

## Scope

KnowMe core Web only.

KMD-156 hardens the public profile experience so a previously loaded profile cannot remain visible or actionable across profile-route changes, authenticated identity changes, failed reloads, or superseded network responses.

## Behavior

- The active profile route and authenticated `user.id` scope profile authority.
- The previous profile is cleared before each authority refresh.
- Loads are generation-scoped so superseded late responses cannot republish stale profile data.
- Profile content is rendered only after the current `/profile-experience/public/:username` request succeeds.
- Wall posting and profile sharing require freshly validated profile authority.
- A failed wall mutation invalidates the rendered profile authority until a successful reload.

## Authority and safety boundaries

- Existing public profile and wall routes remain authoritative.
- No new endpoint or API contract.
- No schema or persistence change.
- No migration.
- No role, friendship, privacy, moderation, entitlement, Premium, KnowCoins, call, device, hardware, legal, or OS-permission change.
- No Nexus core or Nexus × KnowMe integration change.
- No KMD-059 change.

## Validation

KMD-156 must remain unmerged until repository CI is fully green:

- Prisma client generation and schema push;
- complete monorepo build including Next.js Web;
- complete unit suite;
- PostgreSQL API E2E suite;
- any existing Web/Playwright checks executed by CI;
- focused diff review confirming stale public-profile authority cannot remain visible or actionable after refresh, mutation failure, route change, or identity change.

The Web package currently has no dedicated React component runner for this page. The adapted gate is therefore TypeScript/Next.js compilation, repository automated suites, and focused diff review.

## Migration

None.

## Rollback

Restore `apps/web/app/profile/[username]/page.tsx` to its pre-KMD-156 behavior and remove this delivery document. No database rollback is required.
