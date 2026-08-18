# KMD-145 — Mobile archive mutation authority fail-closed

## Scope

KnowMe core Mobile only.

The Mobile archive surface reads the existing `/conversation-archives` and `/conversations` authorities and mutates only the current user's archive state through the existing PUT/DELETE archive endpoints.

Before KMD-145, an archive or restore request could fail while the previously loaded archive/conversation cards remained visible, and a mutation only disabled the action belonging to the same conversation. That left other actions available while the archive authority was in transition.

KMD-145 hardens the surface without widening authority:

- explicitly track whether the archive + conversation authority pair has been freshly validated;
- clear both authority datasets and mark them invalid before every reload;
- render archive/active-conversation cards only while that authority pair is valid;
- allow archive/restore only against a freshly validated authority state;
- serialize archive/restore operations so only one mutation can be in flight;
- disable conversation opening while an archive mutation is in flight;
- if a mutation fails, clear archive/conversation cards immediately and require a successful explicit reload before another action;
- after a successful mutation, revalidate both existing authority endpoints before exposing the new state;
- preserve all existing endpoints, visibility rules and personal archive semantics;
- add no endpoint, schema, persistence, migration, membership mutation, role or permission.

## Boundaries

No Nexus core/integration, Premium, KnowCoins, calls, hardware/device, legal, OS-permission or KMD-059 change.

## Validation

The Mobile package has no dedicated component-test runner. Adapted repository validation is therefore:

1. complete monorepo build including Mobile TypeScript/Expo compilation;
2. complete repository unit suite;
3. PostgreSQL API E2E suite covering the existing archive authorization contract;
4. diff review confirming archive/restore and open actions are unavailable after failed authority refresh or failed mutation;
5. diff review confirming concurrent archive/restore operations are serialized;
6. no unresolved review or security blocker.

Keep the PR draft until standard CI is fully green.

## Migration

None.

## Rollback

Restore the previous `ConversationArchivesExperience` mutation/loading behavior and remove this delivery document. No database rollback is required.
