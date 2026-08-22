# KMD-189 — Web Game Center V2 surface

## Phase

Play for Everyone — Game Center V2.

## Goal

Turn the public catalog and private library delivered by KMD-186 through KMD-188 into a usable Web entrypoint that provides value before signup while progressively unlocking persistence for authenticated players.

## Delivered

- new `/games/center` Web surface;
- public catalog loading without requiring a KnowMe account;
- client-side search and category filtering;
- explicit sign-in/register CTAs for users who want persistence rather than blocking discovery;
- authenticated `Mes jeux` section backed by `/games/library`;
- Continue Playing and pending invitation links;
- private favorite state and add/remove favorite controls for authenticated users;
- no favorite control shown to anonymous visitors;
- Playwright coverage for anonymous value-before-signup and authenticated private-library rendering.

## Privacy and authority boundaries

The Web surface only renders the bounded catalog/library DTOs. It does not request or display game seed, authoritative state, state hash, result payload, owner/winner IDs, replay internals, action history or identities of other participants from `/games/library`.

Anonymous users receive the public catalog only. Authentication is required before the private library or favorite mutations are requested. KMD-189 does not introduce GuestIdentity or anonymous gameplay; those remain separate future security boundaries.

## Accessibility and resilience

Search and category controls have explicit accessible labels. Main sections use semantic headings and the catalog has an accessible region label. Loading errors are surfaced through a status message rather than silently failing.

The existing authoritative `/games` experience remains available for actual session play; this block adds a safer discovery/library entrypoint rather than rewriting the game engine UI in one step.

## Data and schema

No schema or migration is required. KMD-189 consumes the existing public catalog and private library APIs.

## Validation gate

Before merge, the exact PR head must pass dependency audit, Prisma generation, clean migration deploy, zero drift, complete build, unit tests, Chromium Web E2E including the new Game Center tests, and PostgreSQL API E2E.

## Rollback

Revert the new `/games/center` route, browser test and this delivery document. No database rollback is required.

## Follow-up

The next safe block can integrate Game Center navigation more deeply into Web/Mobile and then proceed to Guest Play / Web Instant Games only after the guest identity, consent, abuse and data-minimization boundaries are explicitly designed and tested.
