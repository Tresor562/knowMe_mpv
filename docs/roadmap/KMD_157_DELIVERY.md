# KMD-157 — Web challenge history authority fail-closed

## Scope

KnowMe core Web only.

KMD-157 hardens the authenticated challenge-history surface so stale history rows or feedback cannot remain visible or actionable across identity changes, failed reloads, or superseded network responses.

## Behavior

- The active authenticated `user.id` scopes history authority.
- Previous history rows and selected feedback are cleared before each refresh.
- History and feedback loads are generation-scoped so superseded late responses cannot republish stale state.
- Empty state and history cards render only after `/challenges/history` succeeds for the current identity.
- Feedback opening requires fresh history authority and prevents concurrent detail loads.

## Authority and safety boundaries

- Existing challenge history and result routes remain authoritative.
- No new endpoint or API contract.
- No schema or persistence change.
- No migration.
- No role, challenge scoring, authorization, entitlement, Premium, KnowCoins, call, device, hardware, legal, or OS-permission change.
- No Nexus core or Nexus × KnowMe integration change.
- No KMD-059 change.

## Validation

KMD-157 must remain unmerged until repository CI is fully green:

- Prisma client generation and schema push;
- complete monorepo build including Next.js Web;
- complete unit suite;
- PostgreSQL API E2E suite;
- any existing Web/Playwright checks executed by CI;
- focused diff review confirming stale history and result authority cannot survive refresh or identity changes.

The Web package currently has no dedicated React component runner for this page. The adapted gate is TypeScript/Next.js compilation, repository automated suites, and focused diff review.

## Migration

None.

## Rollback

Restore `apps/web/app/challenges/history/page.tsx` to its pre-KMD-157 behavior and remove this delivery document. No database rollback is required.
