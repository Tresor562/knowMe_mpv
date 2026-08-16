# KMD-100 — Web quick conversation pin toggle

## Scope

KMD-100 exposes the merged KMD-093 personal pin capability directly in the Web Messages list.

- each currently accessible conversation can be pinned or unpinned without opening the separate pin manager;
- the client uses only `PUT /conversation-pins/:conversationId` and `DELETE /conversation-pins/:conversationId`;
- the current pin set and capacity are refreshed from `GET /conversation-pins` after every mutation;
- add-pin controls remain disabled until the server-provided capacity is known;
- when the authoritative limit is reached, unpin remains available while new pin actions are blocked;
- the existing pinned-first ordering updates from the refreshed authoritative set.

## Authority, privacy and safety boundaries

A quick pin is only a private organizational reference. It never grants conversation access, changes membership or roles, modifies notifications, or creates a client-side authorization path. The API remains the sole authority for membership validation, idempotency, stale-reference cleanup, capacity and concurrency protection.

KMD-100 does not modify Nexus core or Nexus × KnowMe integration, Premium, KnowCoins, hardware/device permissions, KMD-059, or any legal/safety gate.

## Validation

Before merge:

1. the complete monorepo production build must pass, including the Next.js Web build;
2. the complete unit suite must remain green;
3. PostgreSQL-backed API E2E must remain green, including the existing KMD-093 authorization, idempotency, capacity and concurrency coverage;
4. the Messages list must never author a numeric capacity and must refresh pin state from the server after mutations;
5. pin controls must remain separate from conversation navigation so interactive controls are not nested;
6. no database or client-storage migration may be introduced.

## Migration

No migration is required. KMD-100 changes only the Web presentation and interaction layer and consumes the already-merged KMD-093 API contract.

## Rollback

Revert the KMD-100 Web commit and remove this document. No database rollback is required; existing personal pins remain intact and continue to be manageable from `/conversation-pins`.
