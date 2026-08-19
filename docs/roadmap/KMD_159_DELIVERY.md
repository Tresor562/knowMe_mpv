# KMD-159 — Web Positive Challenges authority fail-closed

## Scope

KnowMe core Web only.

KMD-159 hardens the consent-sensitive Positive Challenges surface so stale invitations, recipient state, completion confirmations, or catalog choices cannot remain visible or actionable across identity changes, failed reloads, failed mutations, or superseded responses.

## Behavior

- The active authenticated `user.id` scopes Positive Challenges authority.
- Catalog and challenge state are cleared before each authority refresh.
- Loads are generation-scoped so superseded late responses cannot republish stale challenge data.
- Creation, accept, decline, confirm, and cancel actions require fresh authority and block concurrent mutations.
- Failed mutations invalidate rendered authority until a successful reload.
- Recipient/note draft state is cleared when the authenticated identity changes.

## Authority and safety boundaries

- Existing Positive Challenges routes remain authoritative.
- Existing explicit-consent, refusal-without-penalty, double-confirmation, reward, and paid-boost rules are unchanged.
- No new endpoint or API contract.
- No schema or persistence change.
- No migration.
- No role, friendship, consent policy, reward policy, authorization, entitlement, Premium, KnowCoins, call, device, hardware, legal, or OS-permission change.
- No Nexus core or Nexus × KnowMe integration change.
- No KMD-059 change.

## Validation

KMD-159 must remain unmerged until repository CI is fully green:

- Prisma client generation and schema push;
- complete monorepo build including Next.js Web;
- complete unit suite;
- PostgreSQL API E2E suite;
- any existing Web/Playwright checks executed by CI;
- focused diff review confirming stale consent-sensitive Positive Challenges state cannot remain visible or actionable after identity changes, refresh failures, or mutation failures.

The Web package currently has no dedicated React component runner for this page. The adapted gate is TypeScript/Next.js compilation, repository automated suites, and focused diff review.

## Migration

None.

## Rollback

Restore `apps/web/app/positive-challenges/page.tsx` to its pre-KMD-159 behavior and remove this delivery document. No database rollback is required.
