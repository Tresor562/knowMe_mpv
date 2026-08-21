# KMD-161 — Production release preflight

## Purpose

KMD-161 starts the post-KMD-160 market-readiness stream. It adds an explicit fail-closed configuration gate that operators can run before a production release. It does not claim that infrastructure, legal review, device validation, store review, backups, restore drills, or publication have happened.

## Checks

`pnpm check:release` fails unless a production configuration satisfies the minimum machine-verifiable conditions currently represented in repository configuration:

- `NODE_ENV=production`;
- PostgreSQL `DATABASE_URL` exists and is not local;
- `JWT_SECRET` is at least 32 characters;
- public API URL is HTTPS and non-local;
- dedicated sticker signing secret is at least 32 characters;
- TURN is configured with a sufficiently long secret and at least one `turn:` / `turns:` endpoint when production calls require TURN;
- Nexus shared secret and HTTPS server URL are required only when Nexus integration is enabled;
- payment encryption/fraud secrets and HTTPS public/return URLs become mandatory when a payment catalog is actually enabled;
- malformed JSON configuration fails closed.

An empty payment catalog produces a warning instead of a failure. This keeps monetization disabled rather than forcing incomplete payment credentials into a non-commercial release candidate.

## Automated validation

The repository standard `pnpm test` command now also runs `node --test scripts/release-preflight.test.mjs`.

Coverage includes:

- valid hardened environment;
- local endpoints and weak secrets;
- missing TURN configuration;
- conditionally enabled Nexus integration;
- conditionally enabled payments;
- malformed JSON.

## Release boundary

Passing this preflight is necessary but not sufficient for a market release. The release candidate still requires evidence for applicable items such as:

- full repository CI;
- migration rehearsal and rollback;
- backup and restore drill;
- external monitoring/alerting;
- production TLS/domain verification;
- physical Android/iOS checks where required;
- store signing and store review;
- privacy policy and terms review;
- consent/age/territory review where applicable;
- support/moderation operating procedures;
- incident response and data-subject request procedures.

These items must never be marked complete without evidence.

## Migration

None. KMD-161 changes no database schema or persisted product data.

## Rollback

Revert the KMD-161 script, its Node tests, the root `package.json` script changes, and this document. No data rollback is necessary.
