# KMD-200 — Mobile public Guest entry

## Goal

Expose the already validated KMD-199 Guest Quick Math client from the real Expo entry point so a new mobile user can receive value before creating an account, without weakening the account authentication boundary.

## Delivered

- explicit Expo entry point (`apps/mobile/index.tsx`);
- public unauthenticated choice between `Jouer sans compte` and `Connexion / Inscription`;
- automatic bypass of the public choice when an account session is already stored;
- Guest Quick Math entry backed by the isolated KMD-199 Guest transport/storage boundary;
- return from Guest gameplay to the public choice without creating an account;
- pure navigation-policy tests integrated into the Mobile test gate.

## Security and privacy boundaries

- account sessions remain authoritative: a stored account session opens the account experience directly;
- Guest play continues to use its own credential/storage path and never reuses account JWT storage;
- no account identity, relation, message, profile or notification data is exposed from the public choice;
- Guest age-gate and temporary-session confirmation remain enforced inside `GuestQuickMathExperience`;
- this block does not add new backend permissions, database fields, rewards or economic state.

## Deliberate boundary

This is the first real mobile acquisition entry for Guest Play, but it is not physical-device validation. Real Android/iOS installation, back-button behavior, keyboard behavior, SecureStore behavior, deep links, low-memory resume, accessibility with TalkBack/VoiceOver and production EAS builds still require physical/provider evidence.

The account-side `App.tsx` remains unchanged in this block. After a logout that occurs while the account application is already mounted, the existing account auth screen remains the immediate fallback until a future root-state reconciliation or app restart. This is documented rather than hidden; KMD-200 does not claim that post-logout Guest re-entry is fully solved.

## Validation gate

Before merge the exact branch head must pass:

1. production dependency audit;
2. Prisma generation;
3. `prisma migrate deploy` on clean PostgreSQL;
4. migration/datamodel drift check;
5. complete monorepo build including the new Expo entry and React Native TypeScript;
6. all unit tests including `mobile-entry-model.test.ts`;
7. Chromium Web E2E;
8. PostgreSQL API E2E.

## Rollback

Revert the KMD-200 merge commit. No Prisma migration or backend contract is introduced. KMD-199 Guest transport/screen and all authenticated account flows remain available in code.
