# KMD-205 — Account recovery token and input hardening

## Goal

Close a launch-critical parser and resource-abuse gap in account recovery after KMD-204 configuration hardening.

## Delivered

- recovery e-mail inputs are bounded to 254 characters;
- reset tokens are bounded to 4096 characters;
- replacement passwords are bounded to 128 characters while retaining the existing 12-character minimum;
- recovery tokens must contain exactly two dot-separated segments;
- an otherwise valid signed token with appended segments is rejected instead of being accepted through partial parsing;
- decoded recovery payloads must have exactly the expected `sub`, `exp`, `nonce` and `pwd` fields with bounded, typed values;
- unit and PostgreSQL E2E coverage exercise canonical-token rejection and oversized-input rejection.

## Security rationale

Before this delivery, token parsing destructured only the first two values from `token.split('.')`. A valid token with an appended third segment could therefore be treated as equivalent to the canonical signed token. The DTOs also had minimum constraints but no upper bounds, allowing unnecessarily large public unauthenticated recovery payloads to reach application validation/parsing paths.

KMD-205 fails closed on non-canonical token shape and bounds unauthenticated recovery inputs before expensive or stateful account operations.

## Deliberate boundaries

This delivery does not claim to provide distributed throttling, CAPTCHA, mailbox-delivery proof, sender-domain ownership, SPF/DKIM/DMARC validation, physical-device link validation, legal approval, deployment or store publication. Existing controller throttles remain unchanged.

## Migration

No Prisma migration. No persisted data, token signing algorithm, token lifetime, reset semantics, session revocation or provider contract changes.

## Validation gate

Before merge, the exact head must pass:

1. production dependency audit;
2. Prisma generation;
3. clean `prisma migrate deploy`;
4. migration/datamodel zero-drift check;
5. complete monorepo build;
6. unit tests including account-recovery parser cases;
7. Chromium Web E2E;
8. PostgreSQL API E2E including oversized-input and non-canonical-token cases.

## Rollback

Revert the KMD-205 merge commit. No database rollback is required. Existing recovery tokens remain signed with the same algorithm; rollback would only remove the stricter canonical parsing and input bounds.
