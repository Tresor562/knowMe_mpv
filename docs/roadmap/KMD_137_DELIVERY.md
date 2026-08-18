# KMD-137 — Mobile drafts authority refresh fail-closed

## Scope

KnowMe core Mobile only.

The Mobile drafts surface depends on two existing authorities: `/conversation-drafts` for the user's personal draft records and `/conversations` for the conversations the user may currently open. Before KMD-137, a failed refresh could leave the previously loaded drafts and conversation map rendered and actionable, making stale authority-derived state look freshly revalidated.

KMD-137 keeps the existing API and authority boundaries while hardening refresh behavior:

- clear previously loaded drafts before each refresh;
- clear the previously loaded conversation authority map before each refresh;
- keep both collections empty when either required request fails;
- preserve the existing private-draft filtering and conversation-opening behavior after a successful refresh;
- do not add any new endpoint, permission or persistence.

## Boundaries

No new API, schema, persistence, migration, authorization widening, membership/role mutation, message side effect, Nexus core/integration, Premium, KnowCoins, calls, hardware/device, legal, OS-permission or KMD-059 change.

## Validation

The Mobile package has no dedicated test runner, so adapted validation is:

1. Mobile TypeScript compile through the complete monorepo build;
2. complete repository unit suite;
3. PostgreSQL API E2E suite, including existing conversation/draft authorization coverage;
4. diff review confirming stale drafts and conversation authority state are cleared before refresh and remain cleared on failure;
5. no unresolved review or security blocker.

Keep the PR draft until the standard CI is fully green.

## Migration

None.

## Rollback

Remove the pre-refresh and failure-path state clearing from `ConversationDraftsExperience` and remove this delivery document. No database rollback is required.
