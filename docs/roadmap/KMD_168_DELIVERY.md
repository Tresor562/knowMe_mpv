# KMD-168 — Privacy-safe exception correlation

## Goal

Close a launch-readiness privacy gap in the global API exception path while preserving request correlation.

## Delivered

- exception response paths are reduced to the URL path only;
- query strings are excluded from 4xx/5xx error envelopes;
- query strings are excluded from structured 5xx exception logs;
- `x-request-id` correlation remains unchanged;
- focused unit tests cover reset-token/email and export-code redaction;
- no Prisma schema, migration, permission, entitlement or API authority change.

## Security and privacy boundary

Reset tokens, verification codes, email addresses and other values carried in query strings must never be copied into exception logs or error envelopes. This KMD deliberately does not add request/response bodies, cookies, authorization headers or user identifiers to observability output.

## Validation gate

Before merge, the exact branch head must pass dependency installation, Prisma generation/schema push, full monorepo build, unit tests, Chromium Web E2E and PostgreSQL API E2E.

## Rollback

Revert the KMD-168 commit. No database rollback is required.
