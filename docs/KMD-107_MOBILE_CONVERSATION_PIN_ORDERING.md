# KMD-107 — Mobile authoritative conversation-pin ordering

## Scope

KMD-107 exposes the KMD-105 server-owned conversation-pin order in the KnowMe Mobile experience.

- Mobile renders pins in the order returned by `GET /conversation-pins`.
- Users can move a pin up or down.
- Every reorder sends the complete desired pin set to `PUT /conversation-pins/order`.
- Mobile never persists or invents an ordering authority locally.
- After a successful reorder, Mobile reloads the authoritative server state.
- If a reorder fails, Mobile reloads the authoritative state instead of retaining a speculative local order.
- Reorder controls are disabled while another pin mutation is in flight.

This is KnowMe core only. It does not modify Nexus core, Nexus × KnowMe integration, memberships, roles, billing, KnowCoins, Premium, hardware/device flows, or KMD-059.

## Security and authority

KMD-105 remains the sole ordering authority. The API validates the complete set, membership/accessibility, staleness, duplicates, size and serialized user transaction before persisting order. A pin remains personal metadata and never grants conversation access.

## Validation

Required before merge:

1. Prisma generation and PostgreSQL schema push remain green.
2. Monorepo build succeeds, including Mobile TypeScript validation.
3. Full unit suite remains green, including KMD-105 reorder validation and concurrency coverage.
4. PostgreSQL API E2E suite remains green.
5. Manual Mobile behavior check when real-device validation is available: move first/middle/last pins, verify disabled boundary controls, reload the screen, and confirm server order is preserved.
6. No unresolved security/review blocker.

KMD-107 does not introduce a new Mobile test framework. The authoritative reorder contract remains covered by KMD-105 API tests while the Mobile consumer is validated by the existing TypeScript/build pipeline.

## Migration

No migration is introduced by KMD-107. It consumes `ConversationPin.position` and the reorder endpoint introduced by KMD-105.

## Rollback

Revert the KMD-107 Mobile commit(s). No database rollback is required. The KMD-105 API and stored order can remain deployed safely; older clients simply ignore the reorder capability.
