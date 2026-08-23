# KMD-202 — Explicit Guest session revocation

## Goal

Close the privacy gap between deleting a temporary Guest credential locally and actually revoking the corresponding server-side GuestIdentity. Web and Mobile must not claim a Guest session is ended when only local storage was cleared.

## Delivered

- Web and Mobile expose an explicit `Terminer et effacer la session invitée` action;
- clients call the existing authoritative `DELETE /guest/session` endpoint with only the opaque Guest Bearer credential;
- successful server revocation clears the Guest token and saved Quick Math session reference locally;
- a server `401` is treated as an already inactive/expired Guest session and local Guest state can be safely cleared;
- transient network/server failures retain the Guest credential so the user can retry server revocation instead of losing the only handle needed to prove/finish that operation;
- Web returns to the explicit Guest onboarding state after confirmed revocation;
- Mobile resets its Guest UI only after confirmed/already-inactive revocation;
- no account JWT, profile, relationship, message, score, seed, token hash or private account data is added to the revocation request.

## Tests

- Mobile unit policy tests prove only a confirmed invalid/expired `401` failure permits local cleanup; transient, rate-limit and server failures retain the credential;
- Playwright covers a complete Guest Quick Math lifecycle followed by authenticated Guest DELETE, local token/session cleanup and return to onboarding;
- Playwright also proves a `503` revocation failure leaves the Guest token intact and the session retryable;
- existing PostgreSQL API E2E remains authoritative for Guest lifecycle, isolation, expiry and revocation semantics.

## Migration

No Prisma migration. The server revoke endpoint and GuestIdentity status model already exist.

## Privacy and failure semantics

Local-only deletion is intentionally not used as the default `end session` behavior. If the server cannot confirm revocation, the client keeps the opaque credential so the person can retry. GuestIdentity still remains bounded by its existing server TTL and purge policy.

This KMD does not claim legal approval of Guest consent language or deletion/retention wording. Any legal copy change requires separate legal review and consent-version handling.

## Deliberate boundary

No physical Android/iOS proof, OS SecureStore proof, production network failure drill, legal approval, EAS build, deployment, store submission or store publication is claimed.

## Validation gate

Before merge, the exact head must pass:

1. production dependency audit;
2. Prisma generation;
3. clean `prisma migrate deploy`;
4. migration/datamodel zero-drift check;
5. complete monorepo build including Mobile TypeScript and Web;
6. all unit tests including Guest revocation policy;
7. Chromium Web E2E including confirmed and failed revocation;
8. PostgreSQL API E2E.

## Rollback

Revert the KMD-202 merge commit. No database migration is introduced. The existing server `DELETE /guest/session` route remains available, while client behavior returns to the prior local-cleanup-only/mobile and no-explicit-Web-revocation state.