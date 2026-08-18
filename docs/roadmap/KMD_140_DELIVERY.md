# KMD-140 — Mobile archives authority refresh fail-closed

## Scope

KnowMe core Mobile only.

The Mobile archive-management surface depends on two existing authorities: `/conversation-archives` for the user's private archive state and `/conversations` for the conversations the user may currently access. Before KMD-140, a failed refresh after an archive/restore operation could leave previously loaded archive and conversation state rendered, making stale organization state look freshly revalidated and leaving archive actions available against authority data that had not refreshed successfully.

KMD-140 keeps the existing API and authorization boundaries while hardening refresh behavior:

- clear previously loaded archive state before every authority refresh;
- clear the previously loaded conversation authority map before every refresh;
- keep both collections empty when either required request fails;
- expose a loading state while the two authorities are being refreshed;
- do not render the authoritative empty-state copy while loading or after a failed refresh;
- preserve existing archive, restore and open-conversation behavior after a successful refresh;
- do not add any endpoint, permission or persistence.

## Boundaries

No new API, schema, persistence, migration, authorization widening, membership/role mutation, message side effect, Nexus core/integration, Premium, KnowCoins, calls, hardware/device, legal, OS-permission or KMD-059 change.

## Validation

The Mobile package currently exposes TypeScript compilation but no dedicated component test runner. Adapted repository validation is therefore:

1. Mobile TypeScript compilation through the complete monorepo build;
2. complete repository unit suite;
3. PostgreSQL API E2E suite, including the existing conversation/archive authorization contract;
4. diff review confirming stale archive state and conversation authority state are cleared before refresh and remain cleared on failure;
5. no unresolved review or security blocker.

Keep the PR draft until the standard CI is fully green.

## Migration

None.

## Rollback

Remove the pre-refresh/failure-path clearing, loading state and guarded empty-state condition from `ConversationArchivesExperience`, then remove this delivery document. No database rollback is required.
