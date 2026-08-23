# KMD-206 — Account recovery deployment binding

## Goal

Prevent a valid password-recovery token from being accepted by a different KnowMe Web deployment that accidentally shares the same recovery signing secret and account/password state.

## Delivered

- recovery tokens now carry an explicit schema version `v: 1`;
- recovery tokens now carry an `aud` claim bound to the normalized configured `WEB_URL` origin used to build the reset link;
- reset verification requires the current deployment audience to match the signed audience exactly before any account lookup or password hashing;
- decoded payloads fail closed unless they contain exactly `v`, `aud`, `sub`, `exp`, `nonce` and `pwd` with the expected types and bounds;
- reset infrastructure now requires `WEB_URL` as well as `ACCOUNT_RECOVERY_SECRET`, so verification cannot silently omit the deployment boundary;
- unit coverage proves a token issued for one KnowMe Web origin is rejected by another origin even when the signing secret is identical;
- PostgreSQL API E2E coverage asserts that real issued tokens contain the expected version and audience while preserving single-use reset/session-revocation behavior.

## Security rationale

Before this delivery, recovery tokens were signed and password-state-bound but had no deployment audience. If multiple environments reused the same `ACCOUNT_RECOVERY_SECRET` and happened to contain matching user identifiers and password hashes, a token from one environment had no cryptographic claim preventing acceptance in another.

KMD-206 binds every newly issued recovery token to the configured KnowMe Web origin and validates that boundary before database access.

## Compatibility

Recovery tokens issued before KMD-206 do not contain `v` or `aud` and therefore fail closed after rollout. Their previous lifetime was 15 minutes, so deployment must account for that short compatibility window. No account password, session or persisted user data is migrated.

## Migration

No Prisma migration. No database schema or persisted recovery state changes.

## Deliberate boundaries

This delivery does not claim distributed throttling, CAPTCHA, mailbox-delivery proof, sender-domain ownership, SPF/DKIM/DMARC validation, physical-device validation, legal approval, production deployment or store publication. Existing controller throttles and provider behavior remain unchanged.

## Validation gate

Before merge, the exact head must pass:

1. production dependency audit;
2. Prisma generation;
3. clean `prisma migrate deploy`;
4. migration/datamodel zero-drift check;
5. complete monorepo build;
6. unit tests including cross-audience rejection;
7. Chromium Web E2E;
8. PostgreSQL API E2E including version/audience assertions and the existing single-use recovery path.

## Rollback

Revert the KMD-206 merge commit. No database rollback is required. Rollback restores acceptance of the pre-KMD-206 four-field signed payload format; because that weakens deployment isolation, rollback should only be used for an operational emergency while preserving the same 15-minute token lifetime.
