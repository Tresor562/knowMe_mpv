# KMD-136 — Mobile saved-messages authority truthfulness

## Scope

KnowMe core Mobile only.

The Mobile saved-messages surface reads `/saved-messages?limit=100`. That response is a bounded recent batch and must not be presented as an authoritative total. The previous screen also retained the prior batch while a refresh was pending or failed, which could make stale data look freshly revalidated.

KMD-136 keeps the existing API and authority boundaries while hardening presentation:

- clear the previously loaded batch before each authority refresh;
- keep the list empty when the refresh fails instead of retaining stale references;
- label the loaded number as references visible in the recent bounded batch;
- avoid presenting an empty bounded batch as proof that no saved messages exist;
- keep removal behavior and the existing authorization path unchanged.

## Boundaries

No new API, schema, persistence, migration, authorization widening, membership/role mutation, message side effect, Nexus core/integration, Premium, KnowCoins, calls, hardware/device, legal, OS-permission or KMD-059 change.

## Validation

The Mobile package has no dedicated test runner, so adapted validation is:

1. Mobile TypeScript compile through the complete monorepo build;
2. complete repository unit suite;
3. PostgreSQL API E2E suite, including existing saved-message authorization coverage;
4. diff review confirming stale batches are cleared before refresh and the bounded result is never described as an authoritative total;
5. no unresolved review or security blocker.

Keep the PR draft until the standard CI is fully green.

## Migration

None.

## Rollback

Restore the previous `SavedMessagesExperience` loading/header/empty-state behavior and remove this delivery document. No database rollback is required.
