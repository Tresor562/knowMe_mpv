# KMD-207 — Distributed account-recovery request budget

## Goal

Add a launch-critical abuse-control layer for password-recovery requests that is shared across API instances instead of relying only on the in-process NestJS throttler.

## Delivered

- every accepted recovery request path consumes a PostgreSQL-backed rolling-window budget before account lookup;
- the normalized recovery e-mail is never stored in clear text for this budget: KnowMe stores an HMAC-SHA256 fingerprint keyed by `ACCOUNT_RECOVERY_SECRET`;
- requests with an IP address are also bounded by a wider IP-level rolling window;
- budget updates are serialized across API instances with PostgreSQL transaction-scoped advisory locks so concurrent requests sharing an e-mail target or IP cannot independently race past the same budget;
- recovery-attempt audit rows contain the pseudonymous target fingerprint, IP/user-agent context when available, and no recovery e-mail in metadata;
- the service returns HTTP 429 before user lookup when the shared e-mail or IP budget is exhausted;
- the existing controller-level `@Throttle` remains in place as a cheaper first layer, while this delivery provides the shared database-backed boundary;
- unit coverage verifies advisory locking, pseudonymization and fail-closed budget rejection;
- PostgreSQL API E2E coverage verifies that an unknown address remains private and only a pseudonymous recovery-attempt target is persisted.

## Policy

- per normalized e-mail fingerprint: 3 attempts in a rolling 15-minute window;
- per IP address when available: 12 attempts in a rolling 15-minute window;
- blocked attempts remain recorded and therefore continue to count inside the rolling window;
- missing IP context does not collapse all users into a synthetic shared IP bucket: the e-mail budget still applies independently.

## Security and privacy rationale

The NestJS throttler configured at controller level is process-local by default. In a horizontally scaled deployment, requests distributed across multiple API instances could therefore receive a larger effective budget than intended.

KMD-207 adds a second, PostgreSQL-authoritative budget shared by all API instances. The e-mail target is pseudonymized with a keyed HMAC rather than a plain hash so the audit row does not expose recoverable low-entropy e-mail values through simple dictionary hashing.

PostgreSQL advisory locks are derived from separate e-mail/IP namespaces, deduplicated and acquired in sorted order inside the transaction. This serializes competing budget mutations while avoiding inconsistent lock ordering.

## Migration

No Prisma schema migration. KMD-207 reuses the existing `AuditLog` table and its operational retention policy. No new table or column is introduced.

## Deliberate boundaries

This delivery does not claim CAPTCHA/bot-challenge coverage, global network-edge rate limiting, mailbox-delivery proof, sender-domain ownership, SPF/DKIM/DMARC validation, physical-device validation, legal approval, production deployment or store publication. IP rotation and large distributed botnets still require edge/WAF controls in production.

## Validation gate

Before merge, the exact head must pass:

1. production dependency audit;
2. Prisma generation;
3. clean `prisma migrate deploy`;
4. migration/datamodel zero-drift check;
5. complete monorepo build;
6. unit tests including shared-budget and pseudonymization cases;
7. Chromium Web E2E;
8. PostgreSQL API E2E including pseudonymous recovery-attempt persistence and the existing recovery/reset path.

## Rollback

Revert the KMD-207 merge commit. No database rollback is required. Historical `ACCOUNT_RECOVERY_ATTEMPT` audit rows may remain until normal audit retention removes them; they contain only keyed target fingerprints plus ordinary security context, not plaintext recovery e-mails.
