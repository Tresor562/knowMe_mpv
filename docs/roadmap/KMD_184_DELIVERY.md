# KMD-184 — Mobile production build gate

## Goal

Make the mobile production profile explicitly generate store-distributable binaries and fail the existing release preflight if EAS drifts back to an internal/development artifact.

## Delivered

- `apps/mobile/eas.json` now declares production distribution as `store`.
- Android production explicitly builds an `app-bundle` (AAB), not an APK.
- iOS production explicitly disables simulator builds.
- Production keeps `autoIncrement: true` with `cli.appVersionSource: remote` so store build identifiers move forward under EAS authority.
- `submit.production` remains present as the production submission profile boundary.
- `scripts/mobile-release-preflight.mjs` validates both `app.json` store identity and the EAS production profile.
- Unit coverage rejects internal distribution, development clients, APK production output, simulator iOS output, disabled auto-increment, local app-version authority, missing submit profile, and missing production profile.

## Release gate

KMD-184 is acceptable only when the exact PR head passes the repository CI gate already used for launch-readiness work:

1. dependency installation and production dependency audit;
2. Prisma generation;
3. clean `prisma migrate deploy` against PostgreSQL 16;
4. zero Prisma migration/datamodel drift;
5. complete monorepo build;
6. unit tests, including the mobile release preflight tests;
7. Chromium Web E2E;
8. PostgreSQL API E2E.

A real EAS cloud build is intentionally not claimed by these repository tests.

## External evidence still required

Before store submission, the release operator must still provide real evidence for:

- Apple Developer and Google Play Console accounts;
- iOS distribution certificates/provisioning and Android upload/app-signing keys;
- successful EAS production builds on the configured project;
- install/launch on supported physical iOS and Android devices;
- store listing, screenshots, privacy/data-safety declarations, content rating and support/legal URLs;
- upload, review and approval by Apple/Google.

None of those external steps may be marked complete from KMD-184 alone.

## Rollback

If this gate breaks a non-store workflow, keep `development` and `preview` profiles unchanged and revert only the KMD-184 production-profile/preflight changes. Do not weaken `production` into an APK, simulator, internal distribution or development client merely to obtain a green build; use the existing preview profile for internal APK testing.
