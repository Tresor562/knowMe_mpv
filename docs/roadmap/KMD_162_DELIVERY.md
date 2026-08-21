# KMD-162 — Web browser release gate

## Scope

KnowMe core Web and CI only.

KMD-162 restores an explicit browser-level release gate on the public authentication entrypoints that every Web user depends on before an account session exists.

## Delivered

- adds Playwright to the Web workspace;
- adds a Chromium smoke suite for `/login` and `/register`;
- verifies the pages return successfully, render their critical form controls and navigation, and do not emit browser page errors or console errors during the covered flows;
- runs the suite against the production Next.js build, not the development server;
- wires Chromium installation and the Web E2E command into repository CI before API E2E.

## Boundaries

- No API endpoint, schema, migration, authorization, entitlement, account state, security policy or persistence change.
- No attempt is made to create real user accounts in this smoke suite; authoritative registration/login behavior remains covered by API tests.
- This is not a substitute for physical-device, cross-browser, accessibility, legal, privacy, deployment or store validation.
- Nexus core and Nexus × KnowMe integration are unchanged.

## Validation required before merge

- dependency installation;
- Prisma client generation and schema application;
- complete monorepo build;
- complete unit suite;
- Chromium Playwright suite for Web auth entrypoints;
- PostgreSQL API E2E;
- no unresolved review/security blocker.

## Migration

None.

## Rollback

Remove the Playwright Web dependency, `apps/web/playwright.config.ts`, `apps/web/e2e/auth-entrypoints.spec.ts`, and the two Playwright CI steps. No database rollback is required.
