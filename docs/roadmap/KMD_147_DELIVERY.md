# KMD-147 — Mobile folders mutation authority fail-closed

## Scope

KnowMe core Mobile only.

This milestone hardens the private conversation-folder surface so create, assign, unassign, delete, and open actions are exposed only while the current `/conversation-folders` + `/conversations` authority pair has been freshly validated.

## Behavior

- Clears folder and conversation authority before every refresh.
- Revalidates when the current user changes.
- Hides folder mutation controls until both required authorities load successfully.
- Serializes folder mutations through the existing busy state.
- Clears stale folder/conversation authority after any failed mutation.
- Requires an explicit successful reload before another mutation or conversation open action.
- Shows `Aucun dossier` only after a successful authoritative load.

## Boundaries

No new endpoint, schema, persistence, migration, role, permission, membership mutation, Nexus core/integration, Premium, KnowCoins, calls, hardware/device behavior, legal workflow, OS permission, or KMD-059 change.

## Validation

Before merge, require the repository's standard CI to pass on the PR head:

- Prisma client generation;
- Prisma schema push against CI PostgreSQL;
- complete monorepo build including Mobile TypeScript/Expo;
- full unit test suite;
- PostgreSQL-backed API E2E.

Diff review must confirm that failed authority refreshes or folder mutations cannot leave stale folder cards or actionable conversation entries visible.

## Migration

None.

## Rollback

Restore the previous `apps/mobile/src/ConversationFoldersExperience.tsx` behavior and remove this document. No database rollback is required.
