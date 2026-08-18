# KMD-150 — Mobile social hub identity isolation

## Scope

KnowMe core Mobile only.

KMD-150 prevents identity-local state in the Mobile social hub from surviving a `userId` change. The friends, messages, and notifications panels are remounted with identity-scoped React keys, and the hub resets its shared refresh/section state when the authenticated identity changes.

This keeps search results, friend requests, friend lists, notification cards, message-organization navigation, and panel-local busy state from remaining attached to a previous identity context.

## Authority and safety boundaries

- No new API or endpoint.
- No schema or persistence change.
- No migration.
- No authorization widening.
- No membership or role mutation.
- No Nexus core or Nexus × KnowMe integration change.
- No Premium, KnowCoins, call, hardware/device, legal, OS-permission, or KMD-059 change.

All existing server-side authorization remains authoritative.

## Validation

KMD-150 must remain unmerged until the repository's standard CI is fully green:

- Prisma client generation and schema push;
- complete monorepo build, including the Mobile TypeScript build;
- complete unit suite;
- PostgreSQL API E2E suite.

The Mobile package currently exposes `build` (`tsc --noEmit`) but no dedicated component-test runner, so the appropriate automated Mobile regression gate for this narrow state-isolation change is the monorepo/Mobile TypeScript build plus the repository's existing server authorization suites.

Diff review must confirm that changing `userId` remounts all three social panels and resets shared navigation/refresh state, without changing any request contract or server authority.

## Rollback

Restore the prior `SocialHub` panel mounting behavior and remove this delivery document. No database rollback is required.
