# KMD-106 — Web authoritative conversation-pin ordering

## Scope

KMD-106 exposes the KMD-105 server-owned conversation-pin order in the KnowMe Web experience.

- The Web `/conversation-pins` screen renders pins in the order returned by `GET /conversation-pins`.
- Users can move a pin up or down.
- Every reorder sends the complete desired pin set to `PUT /conversation-pins/order`.
- The client never persists or invents an ordering authority locally.
- After a successful reorder, the Web reloads the authoritative server state.
- If a reorder fails, the Web reloads the authoritative state instead of retaining a speculative local order.
- Reorder controls are disabled while another pin mutation is in flight.

This is KnowMe core only. It does not modify Nexus core, Nexus × KnowMe integration, memberships, roles, billing, KnowCoins, Premium, hardware/device flows, or KMD-059.

## Security and authority

KMD-105 remains the sole ordering authority. The API validates the complete set, membership/accessibility, staleness, duplicates, size and serialized user transaction before persisting order. A pin remains personal metadata and never grants conversation access.

## Validation

Required before merge:

1. Prisma generation and PostgreSQL schema push remain green.
2. Monorepo build succeeds, including the Web Next.js build and TypeScript checks.
3. Full unit suite remains green, including KMD-105 reorder validation and concurrency coverage.
4. PostgreSQL API E2E suite remains green.
5. Manual Web behavior check when available: move first/middle/last pins, verify disabled boundary controls, reload the page, and confirm server order is preserved.
6. No unresolved security/review blocker.

No new Web test runner exists in `@knowme/web`; therefore KMD-106 does not introduce a parallel test framework solely for this screen. The authoritative reorder contract is covered in the API unit suite added by KMD-105, while the Web consumer is type/build validated by the standard CI pipeline.

## Migration

No migration is introduced by KMD-106. It consumes the `ConversationPin.position` schema and reorder endpoint introduced by KMD-105.

## Rollback

Revert the KMD-106 Web commits. No database rollback is required. The KMD-105 API and stored order can remain deployed safely; older clients simply ignore the reorder capability.
