# KMD-130 — Mobile conversation pin detail

## Scope

Expose the existing personal pin state inside the Mobile per-conversation organization detail and allow the existing detail card to open the already-authorized pins tool.

This delivery is KnowMe core Mobile only. It does not add or change API routes, persistence, schema, migrations, authorization, membership, roles, message delivery, Nexus core/integration, Premium, KnowCoins, calls, hardware/device behavior, legal gates, OS permissions, or KMD-059.

## Product behavior

`ConversationOrganizationDetail` already summarizes a conversation's personal folder, archive state, draft and saved-message references. KMD-130 adds the missing personal pin state by reusing `GET /conversation-pins`, which is already consumed by `ConversationPinsExperience`.

The detail now indicates whether the conversation is pinned, its personal order position and the pin timestamp when present. Selecting that card uses the existing typed organization callback and opens the existing pins surface. No new authority is introduced and no pin mutation occurs from the detail itself.

## Validation

Required before merge:

- Mobile TypeScript/Expo build succeeds as part of the complete monorepo build;
- existing repository unit suite succeeds;
- PostgreSQL API E2E succeeds;
- standard repository CI is fully green on the PR head;
- diff review confirms that the change only reads the existing personal pins endpoint and extends the existing typed tool union;
- no pin mutation, role change, membership change, message side effect, or authorization widening is introduced.

No dedicated Mobile test runner exists in the current package. For this narrow read-only integration, compile-time checking plus the repository's complete CI is the adapted regression gate.

No migration is required because there is no persistence change.

## Rollback

Remove the `Pin` type, pin request/state lookup, the `pins` tool union entry and pin detail card from `ConversationOrganizationDetail`, then remove this delivery document. No database rollback is required.
