# KMD-143 — Mobile draft authority fail-closed

## Scope

KnowMe core Mobile only.

The individual conversation draft surface reads the existing `/conversation-drafts` authority and writes only through the existing versioned conversation-draft endpoints. Before KMD-143, a failed revalidation could leave previously loaded content, version and `loadedConversation` state in memory. Because the save guard only compared the remembered conversation identifier, the screen could allow a later synchronization attempt to reuse stale authority state after the load had failed. Conflict/error states also did not consistently require a fresh authoritative load before another mutation.

KMD-143 hardens this surface without widening authority:

- clear content, version and the remembered loaded conversation before every authoritative draft load;
- keep those authority-derived values cleared when the load fails;
- notify the parent draft preview that no authoritative draft is loaded while revalidation is pending or failed;
- permit synchronization/deletion only after the current conversation has been freshly loaded and the draft state is ready/saved;
- require an explicit reload after an optimistic version conflict or an authority/error state before another mutation;
- keep local edit controls disabled after a failed authority load until revalidation succeeds;
- preserve the existing optimistic version contract and existing endpoints;
- add no endpoint, schema, permission, persistence or membership mutation.

## Boundaries

No new API, schema, persistence, migration, authorization widening, conversation membership/role mutation, message send side effect, Nexus core/integration, Premium, KnowCoins, calls, hardware/device, legal, OS-permission or KMD-059 change.

## Validation

The Mobile package currently has no dedicated component-test runner. Adapted repository validation is therefore:

1. complete monorepo build including Mobile TypeScript/Expo compilation;
2. complete repository unit suite;
3. PostgreSQL API E2E suite covering the existing draft and conversation authorization/version contracts;
4. diff review confirming stale draft content/version/loaded-conversation authority is cleared before revalidation, remains non-mutable on failure, and conflict/error states require reload before mutation;
5. no unresolved review or security blocker.

Keep the PR draft until standard CI is fully green.

## Migration

None.

## Rollback

Restore the prior `ConversationDraftExperience` load and mutation guards, then remove this delivery document. No database rollback is required.
