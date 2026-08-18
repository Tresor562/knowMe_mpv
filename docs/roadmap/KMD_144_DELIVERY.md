# KMD-144 — Mobile saved-message mutation authority fail-closed

## Scope

KnowMe core Mobile only.

The Mobile saved-messages surface reads the existing bounded `/saved-messages?limit=100` authority and removes a saved reference through the existing `DELETE /saved-messages/:messageId` endpoint. Before KMD-144, a failed removal could leave the previously loaded saved-message cards visible and action-enabled even though the failed mutation might reflect an authorization or visibility change.

KMD-144 hardens the surface without widening authority:

- track whether the current bounded saved-message lot has been freshly validated;
- clear the lot and mark authority invalid before each reload;
- keep the lot hidden when the authority load fails;
- allow open/remove actions only while the current lot is authoritative;
- serialize mutation actions so another saved-message action cannot run while a removal is in flight;
- if removal fails, clear the previously loaded lot and require an explicit successful reload before any further open/remove action;
- preserve the bounded-lot truthfulness introduced by KMD-136;
- keep the existing endpoints and existing visibility filtering unchanged;
- add no endpoint, schema, persistence, migration, role, permission or conversation membership mutation.

## Boundaries

No Nexus core/integration, Premium, KnowCoins, calls, hardware/device, legal, OS-permission or KMD-059 change.

## Validation

The Mobile package currently has no dedicated component-test runner. Adapted repository validation is therefore:

1. complete monorepo build including Mobile TypeScript/Expo compilation;
2. complete repository unit suite;
3. PostgreSQL API E2E suite covering existing saved-message authorization and visibility contracts;
4. diff review confirming stale saved-message cards become unavailable after failed load/removal and no second mutation can run while one is in flight;
5. no unresolved review or security blocker.

Keep the PR draft until standard CI is fully green.

## Migration

None.

## Rollback

Restore the previous `SavedMessagesExperience` load/removal behavior and remove this delivery document. No database rollback is required.
