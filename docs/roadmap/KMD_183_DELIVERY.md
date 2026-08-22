# KMD-183 — Mobile store release identity

## Goal

Make the first commercial mobile release mechanically distinguishable from development builds and block release preflight when required App Store / Play Store identity metadata is missing or obviously unsafe.

## Delivered

- Expo marketing version moved from `0.1.0` to `1.0.0` for the first market release candidate.
- iOS `buildNumber` initialized to `1`.
- Android `versionCode` initialized to `1`.
- Existing stable bundle/package identifier `com.knowme.app` retained on both platforms.
- New `scripts/mobile-release-preflight.mjs` validates:
  - Expo name, slug and deep-link scheme;
  - stable `MAJOR.MINOR.PATCH` version with major version >= 1;
  - reverse-DNS iOS and Android application identifiers;
  - rejection of known placeholder identifiers;
  - positive iOS build number and Android version code.
- `pnpm check:release` now runs the environment preflight and the mobile store metadata preflight.
- The root test gate now includes dedicated mobile release-preflight tests.

## Release discipline

Once an App Store Connect or Google Play record has been created, the bundle/package identifiers must be treated as immutable product identity. Every uploaded binary must increment its platform build identifier (`ios.buildNumber` and `android.versionCode`) even when the public marketing version does not change.

A later public release such as `1.0.1` must therefore update the marketing version and also advance both platform build identifiers before producing new store binaries.

## Evidence boundary

This block does **not** prove that:

- Apple Developer or Google Play Console applications exist;
- signing certificates, provisioning profiles, keystores or EAS credentials are configured;
- store listing metadata, screenshots, age/content declarations, privacy disclosures or Data Safety forms are complete;
- a binary has been signed, uploaded, reviewed or approved;
- a physical iOS/Android release matrix has passed.

Those are external release proofs and must not be marked complete without real evidence.

## Validation

Required before merge:

1. dependency installation and production dependency audit;
2. Prisma generation and clean production migration deploy;
3. zero-drift Prisma comparison;
4. complete monorepo build;
5. unit tests, including the mobile store release-preflight tests;
6. Chromium Web E2E;
7. PostgreSQL API E2E.

## Rollback

If this block must be reverted before store records exist, revert the KMD-183 commits together. If store records or signed binaries already exist, do **not** roll identifiers or build numbers backward: create a forward corrective release with a higher build number/version code instead.
