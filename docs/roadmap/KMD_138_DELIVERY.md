# KMD-138 — Mobile pins authority refresh fail-closed

## Scope

KnowMe core Mobile only.

The Mobile pins surface depends on two existing authorities: `/conversation-pins` for the user's private pin state and capacity metadata, and `/conversations` for the conversations the user may currently access. Before KMD-138, a failed refresh cleared capacity metadata but could leave previously loaded pins and conversations rendered and actionable, making stale authority-derived state look freshly revalidated.

KMD-138 keeps the existing API and authorization boundaries while hardening refresh behavior:

- clear previously loaded pins before each authority refresh;
- clear the previously loaded conversation authority map before each refresh;
- clear pin capacity metadata before each refresh;
- keep all authority-derived collections and capacity metadata empty/unknown when either required request fails;
- do not render the "no pinned conversations" empty state when the authority refresh itself failed;
- preserve existing pin, unpin and ordering behavior after a successful refresh;
- do not add any endpoint, permission or persistence.

## Boundaries

No new API, schema, persistence, migration, authorization widening, membership/role mutation, message side effect, Nexus core/integration, Premium, KnowCoins, calls, hardware/device, legal, OS-permission or KMD-059 change.

## Validation

The Mobile package has no dedicated test runner, so adapted validation is:

1. Mobile TypeScript compile through the complete monorepo build;
2. complete repository unit suite;
3. PostgreSQL API E2E suite, including existing conversation/pin authorization and ordering coverage;
4. diff review confirming stale pin state, conversation authority state and capacity metadata are cleared before refresh and remain cleared on failure;
5. no unresolved review or security blocker.

Keep the PR draft until the standard CI is fully green.

## Migration

None.

## Rollback

Remove the pre-refresh/failure-path clearing and guarded empty-state condition from `ConversationPinsExperience`, then remove this delivery document. No database rollback is required.
