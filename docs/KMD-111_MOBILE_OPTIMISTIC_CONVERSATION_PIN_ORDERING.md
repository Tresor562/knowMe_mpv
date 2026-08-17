# KMD-111 — Mobile optimistic authoritative conversation-pin ordering

## Goal

Adopt the KMD-109 optimistic ordering contract in the KnowMe Mobile conversation-pin manager so a stale mobile session cannot silently overwrite a newer authoritative pin order produced by another client.

## Scope

KnowMe core only. This milestone changes only the Mobile consumer of the existing conversation-pin API plus this delivery note.

No Nexus core or Nexus × KnowMe integration changes, no Premium/KnowCoins changes, no call/hardware work, and no KMD-059 changes.

## Behavior

When the user moves a pinned conversation, Mobile now sends both:

- `conversationIds`: the complete desired order after the move;
- `expectedConversationIds`: the complete authoritative order that was rendered immediately before the move.

The server remains the authority. KMD-109 compares the expected sequence under the existing per-user transaction lock before applying any position updates. If another client changed the order first, the request fails with the existing stale-order conflict instead of overwriting that newer state.

Mobile keeps the KMD-107 recovery rule: after success or failure it reloads the authoritative pin state from `GET /conversation-pins`. It does not preserve speculative ordering after a rejected mutation.

## Safety and concurrency

- The client never supplies arbitrary positions.
- Both arrays represent the complete pin order and remain bounded by the server contract.
- Membership and accessibility are revalidated server-side.
- Ordering remains mutually exclusive with pin/unpin mutations on this screen.
- A stale Mobile session fails closed for the reorder and refreshes from the server.

## Validation

Required before merge:

1. standard GitHub Actions CI is fully green;
2. Prisma generation and PostgreSQL schema push succeed;
3. complete monorepo build succeeds, including Mobile TypeScript validation;
4. complete unit suite succeeds, including the KMD-109 stale-order API tests;
5. PostgreSQL-backed API E2E succeeds;
6. no unresolved review, security, legal, or hardware validation gate applies to this Mobile UI-only contract adoption.

KMD-109 API unit tests remain the authoritative coverage for stale-order detection. KMD-111 does not introduce a parallel Mobile test framework solely for this small consumer change; the Mobile consumer is validated by the existing TypeScript/build pipeline.

## Migration

None. KMD-111 adds no schema or persisted data.

## Rollback

Revert the KMD-111 Mobile commit and this document. KMD-109 keeps `expectedConversationIds` optional, so reverting the client adoption restores the previous backward-compatible KMD-107 behavior without a database rollback.
