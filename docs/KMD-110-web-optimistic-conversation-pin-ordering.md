# KMD-110 — Web optimistic authoritative conversation-pin ordering

## Goal

Adopt the KMD-109 optimistic ordering contract in the Web conversation-pin manager so a reorder cannot silently overwrite a newer authoritative order produced by another client.

## Scope

KnowMe core only. This milestone changes only the Web consumer of the existing conversation-pin API plus this delivery note.

No Nexus core or Nexus × KnowMe integration changes, no Premium/KnowCoins changes, no call/hardware work, and no KMD-059 changes.

## Behavior

When the user moves a pinned conversation, Web now sends both:

- `conversationIds`: the complete desired order after the move;
- `expectedConversationIds`: the complete authoritative order that was rendered immediately before the move.

The server remains the authority. KMD-109 compares the expected sequence under the existing per-user transaction lock before applying any position updates. If another client has changed the order in the meantime, the request fails with the existing stale-order conflict instead of overwriting that newer state.

Web keeps the KMD-106 recovery rule: after success or failure it reloads the authoritative pin state from `GET /conversation-pins`. It does not preserve speculative ordering after a rejected mutation.

## Safety and concurrency

- The client never supplies arbitrary positions.
- Both arrays represent the complete pin order and remain bounded by the server contract.
- Membership and accessibility are still revalidated server-side.
- Ordering remains mutually exclusive with pin/unpin mutations in this screen.
- A stale Web tab fails closed for the reorder and refreshes from the server.

## Validation

Required before merge:

1. standard GitHub Actions CI is fully green;
2. Prisma generation and PostgreSQL schema push succeed even though this milestone has no schema change;
3. complete monorepo build succeeds, including the Web TypeScript/Next build;
4. complete unit suite succeeds;
5. PostgreSQL-backed API E2E succeeds;
6. no unresolved review, security, legal, or hardware validation gate applies to this Web-only milestone.

The KMD-109 API unit coverage remains the authoritative test coverage for stale-order detection. KMD-110 introduces no parallel Web test framework solely for this small consumer change.

## Migration

None. KMD-110 adds no schema or persisted data.

## Rollback

Revert the KMD-110 Web commit and this document. The KMD-109 field is optional, so reverting the client adoption restores the previous backward-compatible KMD-106 behavior without a database rollback.
