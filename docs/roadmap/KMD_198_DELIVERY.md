# KMD-198 — Web Instant Quick Math

## Status

Implementation branch. Keep draft until the exact head passes the repository merge gate.

## Purpose

Deliver the first complete `click -> value` Web path from the Play for Everyone strategy: a person can open KnowMe, create a privacy-minimized temporary Guest identity through an explicit action, play Quick Math, refresh/reconnect, finish the game and leave without creating an account.

KMD-198 consumes the authoritative Guest API merged in KMD-197. It does not duplicate game rules in the browser.

## Public route

`/play/quick-math`

The Game Center routes Guest-eligible Quick Math directly to this page with a `Jouer maintenant` CTA.

## Guest onboarding boundary

The page does **not** create a GuestIdentity on page load.

A new visitor must explicitly:

- optionally choose a temporary alias;
- choose an allowed age-gate state (`ADULT` or `MINOR_ALLOWED`);
- confirm creation of the temporary Guest session;
- press `Jouer sans compte`.

The browser does not request a real name, email address or contacts for Guest Play.

The Web client currently sends Guest consent version `2026-08-22`, matching the current Guest contract introduced with the Play for Everyone baseline. This value is a technical version marker, **not** legal approval. Any change to the public legal text/consent contract requires a coordinated forward update and legal review rather than silently changing stored meaning.

## Credential isolation

Guest gameplay uses a dedicated opaque `knowme_guest_token` stored separately from the account JWT keys.

The Guest API client:

- only attaches that credential to Guest endpoints;
- never sends the account access token as Guest authority;
- clears an invalid Guest credential and saved Guest game reference;
- never exposes the token in rendered state;
- never stores server game seeds.

The account authentication client remains unchanged.

## Gameplay

The Web page renders only the server public projection:

- READY state;
- current round;
- current arithmetic question;
- previous resolved answer;
- current score;
- COMPLETED result.

For each action the browser sends only:

- `START` or `ANSWER`;
- the answer payload when applicable;
- the last server sequence;
- a fresh idempotency key.

The browser does not calculate the authoritative score, completion or result.

## Network recovery

The browser persists only the temporary Guest credential and current Quick Math session ID needed for continuity.

On reload it:

1. validates the Guest credential through `/guest/session`;
2. reloads the authoritative game session;
3. resumes the current round when still available.

If an action request fails after the server may have accepted it, the client re-reads authoritative session state. It accepts recovery only when the server sequence advanced, preventing a blind duplicate action.

Guest game expiry remains controlled by the KMD-197 API, not by browser clocks.

## Account conversion boundary

After completion the UI can link to account registration, but it does **not** claim that the completed Guest score will migrate.

KMD-197 still reports `conversionTransfersGameplayData: false`. A future Guest -> account gameplay migration requires a dedicated data/privacy/abuse review.

## Accessibility

The experience uses:

- semantic headings;
- labelled age, alias and answer controls;
- keyboard-submit form behavior;
- numeric input hinting;
- `aria-live` status feedback;
- explicit progress text;
- no timed browser-only scoring;
- no forced animation or audio.

This is compatible with the future Calm/accessibility direction but does not constitute a complete accessibility audit.

## Tests

New Playwright Chromium coverage verifies:

- page works without an account;
- Guest identity is created only after explicit age/consent input and user action;
- Guest creation does not send email or contacts;
- only the opaque Guest Bearer token authorizes game requests;
- Quick Math session creation;
- explicit START;
- five ANSWER rounds;
- final 5/5 server response rendering;
- registration remains optional after value is delivered;
- browser refresh resumes an existing Guest session;
- no browser console, page or failed-network errors occur in the mocked critical path.

The API/PostgreSQL E2E from KMD-197 remains the authority proving that scores/results are actually server-computed and that Guest isolation/idempotency is enforced in the backend.

## Migration

No Prisma migration.

## Rollback

If the Web Instant experience needs to be disabled after merge:

1. route the Quick Math Game Center CTA back to a non-Guest-safe informational page in a forward patch;
2. remove or disable `/play/quick-math`;
3. leave the KMD-197 API and existing temporary Guest rows intact until normal retention cleanup unless there is a separate security reason to disable Guest gameplay server-side;
4. do not mutate `quick-math@1` game rules.

## Evidence not claimed

KMD-198 does not prove:

- physical Android/iOS behavior;
- Mobile Guest UI;
- offline Guest play;
- production CDN/latency targets;
- external legal approval of the consent text;
- Guest score migration to accounts;
- production deployment;
- store review/approval;
- complete WCAG audit.
