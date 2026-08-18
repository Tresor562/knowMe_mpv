# KMD-129 — Mobile conversation organization actions

## Scope

Enable the existing per-conversation organization cards on Mobile to open their already-authorized organization tools.

This delivery is KnowMe core Mobile only. It does not add or change API routes, persistence, schema, migration, authorization, roles, membership, message delivery, Nexus core/integration, Premium, KnowCoins, calls, hardware/device behavior, legal gates, or KMD-059.

## Product behavior

`ConversationOrganizationDetail` already exposes the typed `ConversationOrganizationTool` callback for four personal tools: folders, archives, drafts, and saved messages. Before KMD-129, `MessagesOrganizationExperience` did not pass that callback, so those cards were intentionally rendered disabled by the detail component.

KMD-129 wires the existing typed callback into the hub. Selecting one of those cards clears the conversation detail state and opens the matching existing organization surface. No new authority is introduced: each destination continues to use its existing authenticated personal API contracts.

## Validation

Required before merge:

- Mobile TypeScript/Expo build succeeds as part of the complete monorepo build;
- existing repository unit suite succeeds;
- PostgreSQL API E2E succeeds;
- standard repository CI is fully green on the PR head;
- diff review confirms the change is navigation-only and the tool type is imported from `ConversationOrganizationDetail`, avoiding a second divergent list of permitted detail actions.

No dedicated Mobile test runner exists in the current package. For this navigation-only wiring, compile-time checking of `ConversationOrganizationTool` plus the repository's standard full CI is the adapted regression gate; no unrelated test framework is introduced solely for this small surface change.

No migration is required because there is no persistence change.

## Rollback

Remove the `ConversationOrganizationTool` type import, `openToolFromConversation`, and the `onOpenTool` prop passed to `ConversationOrganizationDetail`. Remove this delivery document. No database rollback is required.
