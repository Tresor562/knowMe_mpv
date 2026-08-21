# KMD-163 — Secure account recovery

## Scope

KnowMe core authentication, Web recovery entrypoints and production release configuration.

## Security contract

- recovery requests are rate-limited and use a generic public response so account existence is not disclosed;
- recovery infrastructure configuration is checked before account lookup, keeping configuration failures account-independent;
- delivery-provider failures are audited but still return the generic accepted response;
- reset links expire after 15 minutes and are HMAC-signed with a dedicated recovery secret;
- tokens bind to the current password hash fingerprint, so a successful password change invalidates the prior link;
- reset consumption uses a conditional password-hash update inside a database transaction so concurrent replay attempts fail closed instead of allowing two successful password changes;
- the raw recovery token is never persisted;
- the browser receives the recovery token in the URL fragment (`#token=`), which is not included in the initial HTTP request, and removes the fragment from the visible URL immediately after reading it;
- provider calls have an 8-second network timeout so a stalled mail provider cannot leave recovery requests hanging indefinitely;
- a successful reset changes the Argon2 password hash and revokes every active refresh session and trusted device;
- invalid, expired, tampered and password-stale links fail closed;
- recovery requests do not bypass suspension or 2FA login policy after the reset.

## Email delivery

The API uses a configurable HTTPS mail-provider endpoint with bearer authentication and a Resend-compatible JSON envelope (`from`, `to`, `subject`, `html`). No claim is made that production email delivery is active until real production provider credentials and sender-domain configuration have been supplied and tested outside CI.

Required production configuration:

- `ACCOUNT_RECOVERY_SECRET` — dedicated random secret, minimum 32 characters and not shared with JWT signing;
- `ACCOUNT_RECOVERY_EMAIL_ENDPOINT` — HTTPS provider endpoint;
- `ACCOUNT_RECOVERY_EMAIL_API_KEY` — provider credential;
- `ACCOUNT_RECOVERY_EMAIL_FROM` — verified sender identity;
- `WEB_URL` — public HTTPS KnowMe Web origin used for reset links.

The production preflight also refuses a market release when account recovery is disabled, when its secret is shared with JWT signing, or when recovery/provider/Web URLs are not production HTTPS endpoints.

## Validation required before merge

- complete monorepo build;
- complete unit suite including account recovery privacy/tamper/revocation/race coverage;
- Chromium Web recovery entrypoint and URL-fragment scrubbing coverage;
- PostgreSQL account-recovery E2E proving old-session revocation, old-password rejection, new-password login and reset-link single use;
- complete existing PostgreSQL API E2E suite;
- production preflight rejects incomplete recovery configuration;
- no unresolved security/review blocker.

## Migration

None. Recovery tokens are intentionally stateless and bound to the current password hash. Existing session and trusted-device persistence is reused.

## Rollback

Remove the two public recovery routes, `AccountRecoveryService`, recovery DTOs and Web recovery pages/link. Remove the recovery-specific production configuration checks. No database rollback is required because KMD-163 adds no schema or stored recovery-token table.

## Explicit non-claims

CI can validate token integrity, expiry logic, privacy-safe response behavior, replay protection and revocation behavior. It cannot prove inbox delivery, sender-domain reputation, spam placement, production DNS, legal wording, or physical-device/browser email handoff. Those remain release checklist items requiring real-world evidence.
