# KMD-148 — Mobile organization identity authority refresh

## Scope

KnowMe core Mobile only.

This milestone hardens the private conversation organization detail so a change of authenticated/current user identity triggers a fresh authority load instead of reusing organization state loaded for the previous identity context.

## Behavior

- Revalidates the organization detail when either `conversationId` or `currentUserId` changes.
- Clears conversation membership authority before each refresh.
- Clears folders, drafts, archives, pins, and saved-message preview data before each refresh.
- Marks optional sources unavailable until the current refresh settles.
- Keeps the detail fail-closed if `/conversations` cannot be revalidated for the current identity.
- Preserves partial resilience for optional personal organization sources once conversation authority is valid.

## Boundaries

No new endpoint, schema, persistence, migration, role, permission, membership mutation, Nexus core/integration, Premium, KnowCoins, calls, hardware/device behavior, legal workflow, OS permission, or KMD-059 change.

## Validation

Before merge, require the repository's standard CI to pass on the PR head:

- Prisma client generation;
- Prisma schema push against CI PostgreSQL;
- complete monorepo build including Mobile TypeScript/Expo;
- full unit test suite;
- PostgreSQL-backed API E2E.

Diff review must confirm that a user-identity change cannot leave organization cards from the previous identity context visible or actionable while fresh authority is loading or after an authority failure.

## Migration

None.

## Rollback

Restore the previous `apps/mobile/src/ConversationOrganizationDetail.tsx` behavior and remove this document. No database rollback is required.
