# KMD-203 — Mobile account recovery entry

## Goal

Close a launch-critical mobile parity gap: a user who cannot remember their password must be able to request the existing KnowMe account-recovery flow directly from the real Expo public entry instead of requiring prior knowledge of the Web site.

## Delivered

- the unauthenticated mobile root now exposes `Mot de passe oublié ?` alongside Guest Play and account login/registration;
- a dedicated recovery screen submits only the trimmed account email to the existing `POST /auth/password-recovery` contract;
- success copy is intentionally generic so the Mobile client does not reveal whether an account exists;
- obvious incomplete/oversized addresses are rejected locally without changing the authoritative backend validation;
- the user can return to the public root without creating an account or Guest identity;
- authenticated users still bypass the public root and are not routed into recovery accidentally;
- accessibility labels/live-region feedback are included for the recovery email and request result.

## Existing server security reused

The authoritative backend already:

- rate-limits recovery requests;
- returns the same accepted response for unknown/suspended accounts;
- signs short-lived recovery tokens server-side;
- delivers only through configured recovery email infrastructure;
- invalidates a recovery token after the password changes through its password fingerprint;
- revokes existing auth sessions and trusted devices after a successful password reset;
- writes security audit events.

KMD-203 does not weaken or duplicate those controls in Mobile.

## Reset boundary

This block adds the Mobile request entry, not a second reset implementation. The recovery email continues to contain the server-generated KnowMe Web reset link. A future native universal/app-link handoff may be added only with verified domain/app association and physical-device evidence.

## Tests

- Mobile entry routing tests cover the new `recovery` mode and return to the public choice;
- recovery model tests cover whitespace normalization, obvious invalid/oversized address rejection and account-enumeration-neutral success copy;
- the complete Mobile TypeScript build validates the real recovery screen and API call integration;
- existing API/PostgreSQL E2E remains authoritative for recovery request/reset security semantics.

## Migration

No Prisma migration. No new backend route, token format, email provider contract or secret.

## External evidence not claimed

KMD-203 does not claim:

- production email delivery;
- DNS/email-provider configuration;
- legal approval of recovery copy;
- native universal/app-link association;
- physical Android/iOS email-link behavior;
- EAS production build;
- deployment or store publication.

## Validation gate

Before merge, the exact head must pass:

1. production dependency audit;
2. Prisma generation;
3. clean `prisma migrate deploy`;
4. migration/datamodel zero-drift check;
5. complete monorepo build including Mobile TypeScript;
6. all unit tests including account recovery and mobile entry routing;
7. Chromium Web E2E;
8. PostgreSQL API E2E.

## Rollback

Revert the KMD-203 merge commit. No database migration is introduced. Web account recovery and the backend recovery/reset contracts remain unchanged.