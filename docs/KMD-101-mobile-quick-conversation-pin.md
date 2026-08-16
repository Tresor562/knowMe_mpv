# KMD-101 — Mobile quick conversation pin toggle

## Scope

KMD-101 exposes the merged KMD-093 personal conversation-pin capability directly in the Mobile Messages list, as the Mobile counterpart to KMD-100.

- each currently accessible conversation can be pinned or unpinned without opening the separate pin manager;
- the client uses only `PUT /conversation-pins/:conversationId` and `DELETE /conversation-pins/:conversationId`;
- the current pin set and capacity are refreshed from `GET /conversation-pins` after every mutation;
- Mobile does not author a numeric fallback capacity;
- add-pin controls remain disabled until the server-provided capacity is known;
- when the authoritative capacity is reached, unpin remains available while new pin actions are blocked;
- the existing pinned-first ordering updates from the refreshed authoritative set;
- the pin control is a sibling of conversation navigation rather than a nested interactive target.

## Authority, privacy and safety boundaries

A quick pin is only a private organizational reference. It never grants conversation access, changes membership or roles, modifies notifications, or creates a client-side authorization path. The KMD-093 API remains the sole authority for membership validation, stale-reference cleanup, idempotency, capacity and concurrency protection.

KMD-101 does not modify Nexus core or Nexus × KnowMe integration, Premium, KnowCoins, hardware/device permissions, KMD-059, or any legal/safety gate.

## Validation

Before merge:

1. strict Mobile TypeScript compilation must pass as part of the complete monorepo build;
2. the complete unit suite must remain green;
3. PostgreSQL-backed API E2E must remain green, including the existing KMD-093 authorization, idempotency, capacity and concurrency coverage;
4. the Messages list must never author a numeric capacity and must refresh pin state from the server after mutations;
5. pin/unpin controls must remain separate from conversation navigation;
6. failed mutations must keep the last authoritative state and surface a privacy-safe error;
7. no database or client-storage migration may be introduced.

Because KMD-101 adds no new server contract, its behavioral authority/security regression coverage remains the already-merged KMD-093 API tests; the Mobile-specific regression gate is strict compilation plus the standard CI matrix.

## Migration

No migration is required. KMD-101 changes only the Mobile presentation and interaction layer and consumes the already-merged KMD-093 API contract.

## Rollback

Revert the KMD-101 Mobile commit and remove this document. No database rollback is required; existing personal pins remain intact and continue to be manageable from the dedicated Mobile conversation-pin experience.
