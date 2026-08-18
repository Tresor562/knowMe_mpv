# KMD-141 — Mobile archive timeline authority truthfulness

## Scope

KnowMe core Mobile only.

The private Mobile archive timeline reads two existing authorities: `/conversation-archives` and `/conversations`. Before KMD-141, the timeline rendered period sections and authoritative empty-state copy even while those authorities were loading or after a failed load. Its effect also did not re-run when the authenticated `currentUserId` prop changed, so a long-lived component instance could retain authority-derived timeline state across a user-context transition until remount.

KMD-141 hardens the existing surface without widening authority:

- clear archive and conversation-derived state before every authority load;
- clear both collections on any required authority failure;
- revalidate the timeline when `currentUserId` changes;
- do not render archive groups, counts, cards or empty-state claims while loading or after an authority error;
- preserve successful read-only timeline grouping and existing open-conversation behavior;
- add no endpoint, permission, persistence or mutation.

## Boundaries

No new API, schema, persistence, migration, authorization widening, membership/role mutation, archive mutation, message side effect, Nexus core/integration, Premium, KnowCoins, calls, hardware/device, legal, OS-permission or KMD-059 change.

## Validation

The Mobile package currently has no dedicated component test runner. Adapted repository validation is therefore:

1. complete monorepo build including Mobile TypeScript/Expo compilation;
2. complete repository unit suite;
3. PostgreSQL API E2E suite covering the existing conversation/archive authorization contracts;
4. diff review confirming authority-derived timeline state is cleared before revalidation, remains cleared on failure, and no authoritative empty-state copy is shown without a successful load;
5. no unresolved review or security blocker.

Keep the PR draft until standard CI is fully green.

## Migration

None.

## Rollback

Restore the prior one-shot timeline effect and unconditional period rendering in `ConversationArchiveTimelineExperience`, then remove this delivery document. No database rollback is required.
