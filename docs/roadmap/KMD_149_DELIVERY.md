# KMD-149 — Mobile organization hub identity authority

## Scope

KnowMe core Mobile only.

This milestone hardens the private messages organization hub so an authenticated/current-user identity change cannot preserve or republish organization state loaded for the previous identity context.

## Behavior

- Treats `userId` as part of the organization loader identity context.
- Invalidates any in-flight organization authority load when the identity context changes.
- Clears conversation, overview, warning, error, selected tool and selected conversation state on identity changes.
- Revalidates the organization hub automatically when it is open under a new identity context.
- Clears conversation and overview state before every authority refresh so stale cards cannot look freshly validated while a request is pending.
- Preserves KMD-132 partial resilience for optional folder/archive/pin/draft counters after `/conversations` succeeds.

## Boundaries

No new endpoint, schema, persistence, migration, role, permission, membership mutation, Nexus core/integration, Premium, KnowCoins, calls, hardware/device behavior, legal workflow, OS permission, or KMD-059 change.

## Validation

Before merge, require the repository's standard CI to pass on the PR head:

- Prisma client generation;
- Prisma schema push against CI PostgreSQL;
- complete monorepo build including Mobile TypeScript/Expo;
- full unit test suite;
- PostgreSQL-backed API E2E.

Diff review must confirm that an identity change invalidates in-flight organization loads and clears the previous identity's organization navigation/data before a fresh authority load can repopulate the hub.

## Migration

None.

## Rollback

Restore the previous `apps/mobile/src/MessagesOrganizationExperience.tsx` loader/state behavior and remove this document. No database rollback is required.
