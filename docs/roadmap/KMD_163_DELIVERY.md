# KMD-163 — Secure account recovery

## Scope

KnowMe core authentication, Web recovery entrypoints and production release configuration.

## Security contract

- recovery requests are rate-limited and use a generic public response so account existence is not disclosed;
- recovery infrastructure configuration is checked before account lookup, keeping configuration failures account-independent;
- delivery-provider failures are audited but still return the generic accepted response;
- reset links expire after 15 minutes and are HMAC-signed with a dedicated recovery secret;
- tokens bind to the current password hash fingerprint, so a successful password change invalidates the prior link and makes it effectively single-use;
- the raw recovery token is never persisted;
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

## Validation required before merge

- complete monorepo build;
- complete unit suite including account recovery privacy/tamper/revocation coverage;
- Chromium Web recovery entrypoint coverage;
- PostgreSQL API E2E;
- production preflight rejects incomplete recovery configuration when recovery is enabled;
- no unresolved security/review blocker.

## Migration

None. Recovery tokens are intentionally stateless and bound to the current password hash. Existing session and trusted-device persistence is reused.

## Rollback

Remove the two public recovery routes, `AccountRecoveryService`, recovery DTOs and Web recovery pages/link. Remove the recovery-specific production configuration checks. No database rollback is required because KMD-163 adds no schema or stored recovery-token table.

## Explicit non-claims

CI can validate token integrity, expiry logic, privacy-safe response behavior and revocation calls. It cannot prove inbox delivery, sender-domain reputation, spam placement, production DNS, legal wording, or physical-device/browser email handoff. Those remain release checklist items requiring real-world evidence.
