# KMD-142 — Mobile folder search authority truthfulness

## Scope

KnowMe core Mobile only.

The private Mobile folder-search surface reads two existing authorities: `/conversation-folders` and `/conversations`. Before KMD-142, previously loaded folders and conversation labels could remain in memory while a new authority load was running or after it failed. The screen could also continue to render result counts and empty-state copy without a freshly validated authority set, and its effect did not re-run when `currentUserId` changed.

KMD-142 hardens that surface without widening authority:

- clear folder and conversation-derived state before every authority load;
- clear both collections on any required authority failure;
- clear a previous load error before a new revalidation;
- revalidate when `currentUserId` changes;
- render result counts, folder cards and empty-state claims only after both authorities load successfully;
- keep the search query local to the device screen and preserve the existing read-only open-conversation behavior;
- add no endpoint, permission, persistence or mutation.

## Boundaries

No new API, schema, persistence, migration, authorization widening, membership/role mutation, folder mutation, message side effect, Nexus core/integration, Premium, KnowCoins, calls, hardware/device, legal, OS-permission or KMD-059 change.

## Validation

The Mobile package currently has no dedicated component test runner. Adapted repository validation is therefore:

1. complete monorepo build including Mobile TypeScript/Expo compilation;
2. complete repository unit suite;
3. PostgreSQL API E2E suite covering the existing folder/conversation authorization contracts;
4. diff review confirming stale authority-derived search state is cleared before revalidation, remains cleared on failure, and no authoritative result count/cards/empty-state copy render without a successful load;
5. no unresolved review or security blocker.

Keep the PR draft until standard CI is fully green.

## Migration

None.

## Rollback

Restore the prior one-shot folder-search effect and unconditional result rendering in `ConversationFolderSearchExperience`, then remove this delivery document. No database rollback is required.
