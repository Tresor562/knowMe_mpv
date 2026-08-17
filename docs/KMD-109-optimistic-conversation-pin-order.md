# KMD-109 — Optimistic conversation-pin order concurrency

## Scope

KnowMe core only. KMD-109 strengthens the authoritative ordering contract introduced by KMD-105 and normalized by KMD-108 so that two clients holding the same pin set cannot silently overwrite each other's order when they cooperate with the optimistic contract.

`PUT /conversation-pins/order` now accepts an optional `expectedConversationIds` array. This array is the exact ordered pin list the client observed before proposing a new order.

The field is optional for backward compatibility with the already-shipped KMD-106 Web and KMD-107 Mobile consumers. Follow-up client milestones can adopt it without forcing an atomic API/client rollout.

## Authoritative behavior

The API continues to serialize every order mutation on the per-user row lock.

Under that lock it now:

1. loads the current authoritative pins in display order;
2. verifies that the requested target order is exactly the current pin set;
3. when `expectedConversationIds` is supplied, verifies that it exactly matches the current authoritative order, including sequence;
4. returns `409 CONVERSATION_PIN_ORDER_STALE` before any position update if either the set or the optimistic baseline is stale;
5. applies the requested order only after all checks pass.

This closes the same-set lost-update case where client A and client B both know pins `A/B/C`, client A changes the server to `B/A/C`, and client B later submits a reorder based on the older `A/B/C` state.

## Validation and abuse boundaries

- Both target and expected-order arrays are bounded to the existing five-pin maximum.
- Duplicate IDs in either array are rejected as malformed input.
- Membership for every requested target remains revalidated server-side.
- The expected order is concurrency metadata only; it never grants access and is never treated as membership proof.
- A mismatch fails closed before mutation.
- Legacy callers that omit `expectedConversationIds` keep the KMD-105 exact-set protection until Web and Mobile adopt the stronger baseline contract.
- No Nexus core, Nexus × KnowMe integration, Premium, KnowCoins, calls, hardware/device, or KMD-059 behavior changes.

## Persistence / migration

No schema migration is required. KMD-109 uses the existing authoritative `ConversationPin.position` order and the existing per-user transaction lock.

## Tests

Unit coverage includes:

- successful legacy exact-set reorder;
- successful reorder when the optimistic baseline still matches;
- rejection of a stale same-set baseline after another client changed order;
- rejection before mutation for stale pin sets;
- malformed duplicate/oversized target and expected-order arrays;
- inaccessible reorder targets;
- the existing KMD-108 compaction and KMD-093/KMD-105 authority invariants.

Standard repository CI must remain fully green: Prisma generation/schema push, monorepo build, full unit suite, and PostgreSQL API E2E.

## Rollback

Revert the KMD-109 controller/service/tests/documentation changes. No down migration is required. Existing clients that already send `expectedConversationIds` must be rolled back together with the API contract or stop sending that optional field before server rollback.
