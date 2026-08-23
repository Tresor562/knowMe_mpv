# KMD-204 — Account recovery release hardening

## Goal

Close a launch-critical configuration gap left after KMD-203: the production release preflight must reject account-recovery settings that are technically present but unsafe or structurally incapable of producing a trustworthy reset flow.

## Delivered

- `ACCOUNT_RECOVERY_EMAIL_ENDPOINT` must remain HTTPS and may no longer embed username/password credentials;
- the delivery endpoint may not include query strings or fragments, preventing secrets or routing state from being hidden in the configured URL;
- `ACCOUNT_RECOVERY_EMAIL_FROM` must be a bounded, single-line sender identity containing a syntactically valid email address;
- CR/LF sender injection is rejected before release;
- `WEB_URL`, which is used to construct the reset link, must be an HTTPS origin only and may not contain credentials, path, query, or fragment;
- release-preflight tests cover valid production configuration plus malformed endpoint, sender and reset-origin cases without echoing configured secrets.

## Why this is launch-critical

KMD-203 exposes account recovery from the real mobile public entry, while the backend generates reset links from `WEB_URL` and submits recovery mail through the configured provider endpoint. A market preflight that only checks presence/HTTPS can still accept configurations that create malformed reset links, embed credentials in URLs, or allow unsafe sender strings. KMD-204 makes those failures fail closed before release.

## Security boundaries

This block validates configuration shape only. It does not:

- verify ownership of the sender domain;
- prove SPF, DKIM or DMARC configuration;
- send a production recovery email;
- verify provider credentials against the real provider;
- verify DNS, TLS certificates or mailbox delivery;
- alter recovery token signing, expiration, reset semantics, session revocation or audit behavior.

Those remain external operational evidence.

## Migration

No Prisma migration. No API contract or token format changes.

## Validation gate

Before merge, the exact head must pass:

1. production dependency audit;
2. Prisma generation;
3. clean `prisma migrate deploy`;
4. migration/datamodel zero-drift check;
5. complete monorepo build;
6. unit tests including the release-preflight regression cases;
7. Chromium Web E2E;
8. PostgreSQL API E2E.

## Rollback

Revert the KMD-204 merge commit. No database rollback is required. Existing account-recovery endpoints and data remain unchanged.

## External evidence still required before market release

A release owner must still verify the actual production recovery provider, sender-domain ownership/authentication, public reset domain/TLS, successful mailbox delivery, reset-link behavior on supported devices, and the applicable legal/privacy copy. KMD-204 must not be used as proof that those external checks have happened.
