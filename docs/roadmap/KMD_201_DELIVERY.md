# KMD-201 — Mobile root session reconciliation

## Goal

Close the explicit KMD-200 mobile root-state gap: once an account session that had entered the authenticated application is cleared, the Expo root must return to the public value-before-registration choice instead of leaving the user trapped in the account-only authentication fallback.

## Delivered

- account session persistence now publishes in-process presence changes after successful save/clear operations;
- the mobile root subscribes to those changes without polling SecureStore or AsyncStorage;
- an explicit loss of an account session while root mode is `account` returns to the public `Jouer sans compte` / `Connexion / Inscription` choice;
- selecting `Connexion / Inscription` with no existing account session remains valid and is not immediately bounced back to the public choice;
- Guest mode is not interrupted by unrelated account-session presence notifications;
- failed refreshes already clearing the account session now also reconcile the root through the same narrow signal;
- pure routing-policy tests cover the downgrade boundary.

## Security and privacy boundaries

- the signal contains only a boolean session-presence state; it does not publish JWTs, refresh tokens, user IDs, profiles or Guest credentials;
- session storage remains authoritative and unchanged: access/refresh tokens stay in the existing secure storage boundary;
- observers cannot block save/clear persistence: listener failures are isolated;
- the public Guest credential path remains separate from account JWT storage;
- a generic UI selection still cannot silently downgrade authenticated account mode; only an explicit account-session loss signal can reconcile it.

## Migration

No Prisma migration. No backend authorization contract changes.

## Deliberate boundary

This block does not claim physical Android/iOS validation, OS-level SecureStore verification, back-button behavior, VoiceOver/TalkBack proof, production EAS build, legal approval, store submission, or store publication.

The session-presence notification is process-local by design. Startup/restart reconciliation continues to use `hasSession()` from secure storage, while in-process save/clear events cover the previously documented post-logout/account-deletion/session-invalidation gap.

## Validation gate

Before merge, the exact branch head must pass:

1. production dependency audit;
2. Prisma generation;
3. clean `prisma migrate deploy`;
4. migration/datamodel drift check;
5. complete monorepo build including Mobile TypeScript;
6. all unit tests including the KMD-201 root-session reconciliation cases;
7. Chromium Web E2E;
8. PostgreSQL API E2E.

## Rollback

Revert the KMD-201 merge commit. There is no database migration. The KMD-200 public mobile entry remains available, but its previously documented post-logout root-state limitation returns.