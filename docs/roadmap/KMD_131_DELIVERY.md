# KMD-131 — Mobile organization overview

## Scope

Add a read-only overview to the Mobile private conversation organization hub using only existing KnowMe-authorized collection endpoints.

This delivery is KnowMe core Mobile only. It does not add or change API routes, persistence, schema, migrations, authorization, membership, roles, message delivery, Nexus core/integration, Premium, KnowCoins, calls, hardware/device behavior, legal gates, OS permissions, or KMD-059.

## Product behavior

When the user opens the existing private organization hub, Mobile loads the conversations plus the existing personal folders, archives, pins and drafts collections in parallel. It renders compact counts for those collections above the existing organization tools.

The overview is informational only. It introduces no mutation and does not expose data beyond the endpoints that the same authenticated Mobile surfaces already consume independently.

The per-conversation helper copy is also kept aligned with KMD-130 by mentioning the personal pin state now present in `ConversationOrganizationDetail`.

Saved-message counts are intentionally not included because the existing saved-message list is paginated/limited and would not provide an authoritative total from the current client contract.

## Validation

Required before merge:

- Mobile TypeScript/Expo build succeeds as part of the complete monorepo build;
- existing repository unit suite succeeds;
- PostgreSQL API E2E succeeds;
- standard repository CI is fully green on the PR head;
- diff review confirms the overview only reads existing personal endpoints;
- no authorization widening, mutation, membership/role change or message side effect is introduced.

No dedicated Mobile test runner exists in the current package. For this narrow read-only composition, compile-time checking plus the repository's complete CI is the adapted regression gate.

No migration is required because there is no persistence change.

## Rollback

Restore the organization hub to loading `/conversations` only, remove the `OrganizationOverview` state and overview cards, and remove this delivery document. No database rollback is required.
