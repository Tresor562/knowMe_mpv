# KMD-174 — Production Web Content Security Policy baseline

## Goal

Add an enforced production Content-Security-Policy to the Next.js Web application using only the resource classes and origins currently required by KnowMe, without inventing deployment evidence or weakening browser/OS consent boundaries.

## Audited runtime needs

The current Web runtime loads application scripts/styles from the same origin, uses inline Next.js bootstrap/style content, may render local/data/blob images, may render blob media, and connects to the public KnowMe API plus its Socket.IO WebSocket endpoint through `NEXT_PUBLIC_API_URL`.

No current audited requirement was found for arbitrary third-party scripts, wildcard network origins, plugins/objects, cross-origin framing, or `unsafe-eval` in the production Web runtime.

## Changes

- Adds an enforced `Content-Security-Policy` only to production responses.
- Restricts `default-src`, `base-uri`, `object-src`, `frame-ancestors`, `form-action`, scripts, styles, images, media, fonts, workers, manifests and network connections.
- Derives the allowed API HTTP(S) origin and matching WebSocket origin from `NEXT_PUBLIC_API_URL`.
- Ignores malformed or non-HTTP(S) public API values when building CSP sources instead of serializing arbitrary schemes into the policy.
- Keeps `unsafe-inline` only where the current Next.js runtime requires inline bootstrap/style content; `unsafe-eval` and wildcard sources are not allowed.
- Extends Playwright security-header tests to gate the enforced CSP on `/login` and `/register` and retain the attacker-controlled query-string non-reflection regression.

## Security and privacy boundaries

- CSP values never include request URLs, query strings, cookies, Authorization headers, account identifiers or tokens.
- `frame-ancestors 'none'` reinforces the existing anti-framing baseline.
- `object-src 'none'` disables legacy plugin/object execution.
- `connect-src` is restricted to same-origin plus the configured KnowMe API and its corresponding WebSocket transport.
- This policy does not grant microphone/camera access and does not weaken KMD-059 explicit browser/OS consent.
- This repository policy is not proof that public DNS, TLS, CDN/proxy behavior, payment-provider redirects, media CDN configuration or every real production page has been physically validated.

## Validation gate

Before merge, the exact branch head must pass:

1. dependency installation;
2. Prisma generate/push against PostgreSQL;
3. full monorepo build;
4. complete unit suite;
5. Chromium Web E2E including the CSP regression suite;
6. PostgreSQL API E2E.

Any CSP violation exposed by the existing critical Web flows must be fixed by explicitly auditing the required source; wildcard sources or `unsafe-eval` must not be added as a shortcut.

## Follow-up hardening

A future nonce/hash-based script policy can remove `unsafe-inline` after the Next.js runtime and all inline application styles/scripts are migrated and verified. That is a separate hardening task and must not be claimed complete here.

## Rollback

Revert the KMD-174 merge. This removes the production CSP and its added Playwright assertions. There is no database schema or migration rollback.
