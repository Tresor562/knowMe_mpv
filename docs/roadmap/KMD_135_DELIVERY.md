# KMD-135 — Mobile saved-message preview truthfulness

## Scope

KnowMe core Mobile only.

The per-conversation organization detail previously displayed the number of saved-message references found in `/saved-messages?limit=100` as a bare numeric count. That endpoint is explicitly capped and applies visibility filtering after selecting the bounded batch, so the number cannot safely be presented as an authoritative total for a conversation.

KMD-135 keeps the existing bounded read and changes only the presentation:

- the card now labels the data as a loaded preview rather than a total;
- the visible count is described as references found in the recent loaded batch;
- zero in the loaded batch is not described as proof that the conversation has no saved messages;
- the existing saved-messages tool remains the canonical place to inspect accessible saved-message references.

## Boundaries

No new API, schema, persistence, migration, authorization widening, membership/role mutation, message side effect, Nexus core/integration, Premium, KnowCoins, calls, hardware/device, legal, OS-permission or KMD-059 change.

## Validation

The Mobile package currently has no dedicated test runner. Adapted validation is therefore:

1. Mobile TypeScript compile through the monorepo build;
2. complete repository unit suite;
3. PostgreSQL API E2E suite, including the existing saved-message authority coverage;
4. diff review confirming the bounded `/saved-messages?limit=100` contract is not described as an authoritative total;
5. no unresolved review/security blocker.

The PR must remain draft until the standard CI is fully green.

## Migration

None.

## Rollback

Restore the previous saved-message card title/detail in `apps/mobile/src/ConversationOrganizationDetail.tsx` and remove this delivery document. No database rollback is required.
