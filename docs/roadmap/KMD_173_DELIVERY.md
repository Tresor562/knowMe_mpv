# KMD-173 — Web security headers baseline

## Goal

Harden the production Next.js frontend with a privacy-safe response-header baseline without weakening camera/microphone consent, inventing deployment evidence, or introducing a CSP that could break the current application before its resource graph is explicitly audited.

## Changes

- Added a Next.js response-header policy for all Web routes.
- Added `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-DNS-Prefetch-Control: off`, `Cross-Origin-Opener-Policy: same-origin`, and a restrictive `Permissions-Policy`.
- Camera and microphone are limited to the same-origin Web application so the existing explicit-consent call flow can still request them; geolocation, payment and USB are denied.
- Added HSTS for production builds.
- Added Chromium/Playwright coverage against the production Next.js server for login and registration entrypoints.
- Added a regression test proving query-string data is not reflected into security headers.

## Security and privacy boundaries

- Header values are static and never include URLs, query strings, tokens, cookies, user IDs, account data or Authorization values.
- `Permissions-Policy` does not grant camera or microphone access by itself. It only allows the same-origin document to request those capabilities; operating-system/browser permission and KnowMe's explicit user-triggered KMD-059 flow remain mandatory.
- Cross-origin frames cannot inherit camera or microphone through this policy.
- No Content-Security-Policy is introduced here. A production Web CSP must be designed from an audited list of scripts, styles, images, media, API/WebSocket origins and Next.js runtime requirements; using an unsafe or guessed CSP would create false security or regressions.
- HSTS emission in repository code is not proof that the public Web domain, subdomains, CDN, proxy, DNS or TLS are correctly configured.

## Validation gate

Before merge, the exact branch head must pass:

1. dependency installation;
2. Prisma generate/push against PostgreSQL;
3. full monorepo build;
4. complete unit suite;
5. Chromium Web E2E including `security-headers.spec.ts`;
6. PostgreSQL API E2E.

No physical Web/iOS/Android hardware validation, public deployment, DNS/TLS validation or store publication is claimed by CI.

## Rollback

Revert the KMD-173 merge. This removes `apps/web/next.config.mjs`, the dedicated Playwright regression suite and this delivery note. There is no database migration or schema rollback.
