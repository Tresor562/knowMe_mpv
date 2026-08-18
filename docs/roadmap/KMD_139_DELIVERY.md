# KMD-139 — Mobile folders authority refresh fail-closed

## Scope

KnowMe core Mobile only.

The Mobile folders surface depends on two existing authorities: `/conversation-folders` for the user's private organization state and `/conversations` for the conversations the user may currently access. Before KMD-139, a failed refresh could leave previously loaded folders and conversation authority state rendered and actionable, making stale organization state look freshly revalidated.

KMD-139 keeps the existing API and authorization boundaries while hardening refresh behavior:

- clear previously loaded folders before each authority refresh;
- clear the previously loaded conversation authority map before each refresh;
- keep both collections empty when either required request fails;
- do not render the "Aucun dossier" empty state when the authority refresh itself failed;
- preserve existing folder creation, assignment, unassignment and deletion behavior after a successful refresh;
- do not add any endpoint, permission or persistence.

## Boundaries

No new API, schema, persistence, migration, authorization widening, membership/role mutation, message side effect, Nexus core/integration, Premium, KnowCoins, calls, hardware/device, legal, OS-permission or KMD-059 change.

## Validation

The Mobile package has no dedicated test runner, so adapted validation is:

1. Mobile TypeScript compile through the complete monorepo build;
2. complete repository unit suite;
3. PostgreSQL API E2E suite, including existing conversation/folder authorization coverage;
4. diff review confirming stale folder state and conversation authority state are cleared before refresh and remain cleared on failure;
5. no unresolved review or security blocker.

Keep the PR draft until the standard CI is fully green.

## Migration

None.

## Rollback

Remove the pre-refresh/failure-path clearing and guarded empty-state condition from `ConversationFoldersExperience`, then remove this delivery document. No database rollback is required.
