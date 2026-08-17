# KMD-121 — Web conversation organization entrypoint

## Scope

Expose the existing KMD-119 private, read-only conversation organization detail directly from the Web Messages list.

This milestone only adds navigation. It does not create or modify folders, archives, drafts, saved messages, conversation membership, permissions, Nexus behavior, Premium, KnowCoins, or any persistence model.

## Implementation

- Each authorized conversation rendered by `/messages` now exposes an `Organisation privée` action.
- The action targets the existing KMD-119 route `/messages/:conversationId/organization`.
- The conversation itself remains the source of the identifier: no organization state is cached or reconstructed in the Messages list.
- The existing pin action stays independent from navigation to avoid changing pin semantics.

## Security and authority

KMD-121 creates no new authorization boundary. The organization detail continues to load only the current user's already-authorized conversation and personal organization resources through the existing authenticated APIs.

A navigation link must never be interpreted as proof of membership. Server-side membership and personal-resource checks remain authoritative.

This delivery is KnowMe core only. It does not alter Nexus core or Nexus × KnowMe integration.

## Validation

1. Run the standard monorepo CI.
2. Confirm the Web Next.js build succeeds.
3. Open `/messages` as an authenticated user and verify each visible conversation has an organization action.
4. Verify the action opens `/messages/<conversationId>/organization` for that exact conversation.
5. Verify the normal conversation link still opens `/messages/<conversationId>`.
6. Verify pin/unpin remains independent and unchanged.
7. Verify no organization data is written when the action is used.

The Web package currently has no dedicated test runner; KMD-121 therefore relies on the repository's standard TypeScript/Next build plus the existing API tests that protect the underlying organization authorities.

## Migration

No migration. No schema or persistent data changes.

## Rollback

Revert the KMD-121 commit that adds the organization link to `apps/web/app/messages/page.tsx` and remove this delivery document. No data rollback or down migration is required.
