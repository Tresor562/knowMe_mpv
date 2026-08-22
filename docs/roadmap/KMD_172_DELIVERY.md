# KMD-172 — API security headers baseline

## Goal

Harden production-facing API responses against common browser interpretation and framing risks without widening application permissions, exposing request data, or adding a new runtime dependency.

## Changes

- Added a small API middleware that emits static security headers on every response.
- Added a restrictive API-only Content Security Policy (`default-src 'none'`, no base URI, no framing, no form submissions).
- Disabled referrer disclosure, MIME sniffing, framing, DNS prefetching, and browser access to camera, microphone, geolocation, payment and USB from API documents.
- Added HSTS only when `NODE_ENV=production`.
- Wired the middleware before HTTP observability in the API bootstrap.
- Added unit coverage for baseline headers, production-only HSTS, middleware continuation and non-reflection of attacker-controlled request data.
- Documented deployment verification and the remaining external HTTPS/HSTS evidence requirement.

## Security and privacy boundaries

- Header values are static and never include URL, query string, Authorization, cookies, tokens, user identifiers or request bodies.
- No account, permission, entitlement, moderation, payment, Nexus, schema or migration behavior changes.
- The API CSP is intentionally suitable for JSON/API responses only. It is not a substitute for a frontend Web CSP.
- HSTS is emitted in production configuration but is only operationally safe once the deployed API domain and covered subdomains are confirmed HTTPS-only.

## Validation gate

Before merge, the exact branch head must pass:

1. dependency installation;
2. Prisma generate/push against PostgreSQL;
3. full monorepo build;
4. unit tests including `security-headers.spec.ts`;
5. Chromium Web E2E;
6. PostgreSQL API E2E.

No physical deployment, DNS, TLS, CDN, proxy, browser-domain or store validation is claimed by repository CI.

## Rollback

Revert the KMD-172 commit/merge. This removes the middleware import/use plus its tests and documentation; there is no database rollback or migration.
