# KMD-199 — Mobile Guest Quick Math client baseline

## Goal

Bring the server-authoritative Guest Quick Math contract from KMD-197/KMD-198 into the React Native client without mixing Guest credentials with the account JWT/session boundary.

## Delivered

- isolated mobile Guest credential storage (`knowme_guest_token`), using Expo SecureStore on native platforms with AsyncStorage only as migration/fallback storage;
- separate local Guest Quick Math session id;
- Guest identity creation with the same technical consent marker used by the Web flow (`2026-08-22`), explicit age-gate state, and optional temporary alias;
- Guest identity/session resume primitives;
- server-authoritative Quick Math create/start/answer lifecycle;
- unique mobile idempotency keys for create/actions;
- uncertain-action recovery by re-reading the authoritative session before surfacing a transport failure;
- explicit local Guest cleanup;
- a reusable `GuestQuickMathExperience` React Native screen implementing age gate, temporary-session confirmation, resume, five-round play, replay and local cleanup;
- pure mobile tests for Guest-entry gating, strict integer answer parsing and authoritative sequence recovery policy.

## Security and privacy boundaries

- Guest credentials are never written to `knowme_access_token`, `knowme_refresh_token` or trusted-device account storage.
- Account `apiFetch` is not reused for Guest gameplay because it can attach/refresh account JWTs.
- The client never accepts or computes authoritative score, winner, reward or economy state.
- The server response remains the only rendered source of gameplay truth.
- Guest state remains temporary and can expire according to the server-side KMD-191/KMD-195 lifecycle.
- The consent marker in code is a technical version marker, not legal approval.

## Deliberate boundary

This block provides and compiles the mobile Guest gameplay client and screen, but does **not** yet claim that unauthenticated acquisition/navigation in `App.tsx` is released. The current application root still opens its existing authentication experience first. A following KMD must wire a reviewed authless `Jouer sans compte` entry into the root navigation and then validate it on real iOS/Android devices.

No physical-device validation, EAS build, store submission, legal approval, production latency proof, offline Guest play or Guest-to-account gameplay migration is claimed.

## Validation gate

Before merge the exact branch head must pass:

1. production dependency audit;
2. Prisma generation;
3. `prisma migrate deploy` on a clean PostgreSQL database;
4. migration/datamodel drift check;
5. complete monorepo build, including React Native TypeScript;
6. all unit tests, including `guest-quick-math-model.test.ts`;
7. Chromium Web E2E;
8. PostgreSQL API E2E.

## Rollback

Revert the KMD-199 merge commit. No Prisma migration or server contract change is introduced by this block. Existing Web Guest Play and account-bound Mobile flows remain unchanged.
