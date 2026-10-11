# KnowMe universal @username mentions — first integrated slice

## User contract

- A syntactically valid `@username` in user-authored visible text uses the current theme accent and is keyboard/touch accessible.
- Clicking the name checks the **existing public profile endpoint** before navigation. A missing account (HTTP 404) is not mistaken for an offline service.
- HTTP 403/410 means unavailable; network/server failures mean verification could not complete. Labels support French and English.
- Web navigates to the public profile screen. Android opens the native public-profile surface, respecting the server's visible/locked fields.
- The renderer escapes user input as ordinary React text, not HTML. E-mail addresses, malformed usernames and excessively long handles stay plain text.
- A handle that appears plausible is not asserted to exist merely because it is styled as a link.

## Files and coverage in this slice

- Shared `@knowme/link-contract` parser and boundary tests.
- Web chat text; feed authors, posts, discussion authors and comments.
- Android chat text; feed/discussion post and comment content plus author handles.
- Android app-level `PublicProfileProvider` makes a single native profile destination reusable by other surfaces.

## Not complete / required follow-up before universal claim

- Wire the renderer into **all remaining** story text, channel posts, biographies, search results, notifications, forwarded messages, and user-generated surfaces; audit public and private text containers.
- Add verified `@` autocomplete with avatars and sensible privacy rules in each composer, using the canonical account directory.
- Provide the complete mobile public-profile screen (this slice opens the native profile identity, avatar, bio and lock state only).
- Add view tests, profile API error-state tests, localization/accessibility checks and manual Android/Web testing in light, dark, AMOLED, slow connection and large font modes.
- This PR creates code only. It does not assert that a physical-device APK, production API, or Vercel deployment has been validated.

## QA scenarios

1. `@Alice_1` exists: linked inline and resolves into that account's profile.
2. `@does_not_exist_987` returns 404: show missing account feedback; no navigation.
3. HTTP 403/410: show unavailable profile feedback.
4. Network offline/500: show verification failure and retry suggestion; do not claim username is missing.
5. `abc@example.com`, `@ab` and overlong handles: remain plain text.
6. Private/locked profile: show only fields exposed by server snapshot.
7. Tapping a mention inside a feed card must not inadvertently open the feed card.

## Rollback

Revert this branch/PR. No database changes or migrations.
