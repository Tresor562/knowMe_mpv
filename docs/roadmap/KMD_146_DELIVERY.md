# KMD-146 — Mobile pin mutation authority fail-closed

## Scope

KMD-146 hardens the existing Mobile private conversation pin surface. Pin, unpin, reorder and open actions are available only after both `/conversation-pins` and `/conversations` have been freshly validated. Concurrent pin mutations are serialized. If a pin mutation or reorder fails, previously loaded authority-derived cards and capacity metadata are cleared so stale state cannot remain actionable.

## Boundaries

- KnowMe core Mobile only.
- No new API endpoint or widened authorization.
- No schema or persistence change.
- No migration.
- No membership or role mutation.
- No Nexus core or Nexus × KnowMe integration change.
- No Premium, KnowCoins, calls, device, legal, OS-permission or KMD-059 change.

## Behavior

- Fresh load clears pin/conversation authority and capacity metadata before revalidation.
- Successful `/conversation-pins` + `/conversations` load marks the surface authoritative.
- Failed load leaves all authority-derived state cleared and exposes an explicit reload action.
- Pin, unpin, reorder and conversation-open actions are disabled while authority is invalid or a pin mutation is in progress.
- A failed pin, unpin or reorder invalidates the loaded authority and requires a successful reload before another action.
- Empty-state and capacity copy are rendered only from freshly validated authority.

## Validation

Required before merge:

1. Review the diff and confirm only the Mobile pins surface and this delivery note changed.
2. Standard repository CI must be fully green, including:
   - Prisma client generation;
   - Prisma schema push against CI PostgreSQL;
   - complete monorepo build, including Mobile TypeScript/Expo;
   - complete unit suite;
   - PostgreSQL API E2E.
3. Confirm no unresolved review/security thread remains.
4. Confirm `/conversation-pins` and `/conversations` remain the existing server authorities and no client-side plan/role/permission elevation is introduced.

The Mobile package currently has no dedicated component-test runner, so the complete Mobile TypeScript build plus repository unit/E2E gates are the adapted regression validation for this narrow authority-state hardening.

## Migration

None.

## Rollback

Restore the previous `ConversationPinsExperience` loading/mutation behavior and remove this file. No database rollback is required.
