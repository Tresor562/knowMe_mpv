# KnowMe 1.1.3 · APK update and Web delivery (preview channel)

## Goal
A code merge must not be mistaken for an installed Android update.
The production Web project deploys `main` via Vercel Git integration.
The Android APK is a **separate immutable binary** whose native modules require
re-installation with a newer package version; Android itself confirms it.

## 1.1.3 preview contents
- Android app version `1.1.3`, versionCode `5` (previous public preview:
  `1.1.2`, versionCode `4`), package `com.knowme.app`.
- Preserves the native gallery, microphone/Ogg/Opus bridge, stickers, navigation,
  profiles and post/story editor introduced in the newer source commits.
- Web/API/product contract metadata updated to `1.1.3`.
- Web `/update` no longer serves a stale hardcoded APK if the live update feed
  is unavailable; it directs users to the official Releases listing.

## Auto-publication of test APKs
`.github/workflows/knowme-compatible-preview-update.yml` runs on successful
main-branch CI (and can be manually dispatched) and:
1. Requires the tested source SHA to be current `main`.
2. Requires successful **quality** and **android-apk** checks on that SHA.
3. Downloads only the matching `knowme-android-apk` artifact from a successful
   `KnowMe APK Build Once` workflow.
4. Verifies checksum, APK validity, package/versionCode/versionName, and **exact**
   previously audited Android Debug signing certificate
   `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
5. Publishes an **immutable prerelease** `v1.1.3-preview` with APK, SHA-256 and
   `knowme-update.json`; never overwrites already-published version files.
6. Fails closed on any mismatch. It does not promote debug-signed APKs to the
   production signing identity.

GitHub action and live API discovery run independently; a public APK release is
not the same as successful discovery by the API or installation on a real phone.

## Installed APK discovery
The existing client checks `GET /mobile-updates/android` and prompts the
user for a higher versionCode. The API must be up-to-date and reachable from
the Android network; GitHub manifest discovery may be cached for 15 minutes.
The Android package must already include `KnowMeApkInstaller`, whose native
code validates APK package, versionCode and checksum and delegates installation
to the system consent flow.

**Important:** a production-signed APK or one signed with another debug
certificate cannot be upgraded from this debug-signed preview in place. Never
recommend uninstalling the old APK without exporting/safeguarding its local
data. The update is a preview, not a public security/market release.

## Release acceptance evidence needed
- GitHub CI success and APK build on the exact `main` source commit.
- GitHub Release `v1.1.3-preview` published with three immutable assets and
  the same certificate as existing audited preview APKs.
- Vercel production deployment READY with the same source SHA.
- API `/mobile-updates/android` advertises versionCode 5 and the exact
  SHA256 manifest (or explicitly diagnose API deployment/caching).
- Two account smoke tests for text, posts, stories, gallery, stickers and audio.
- Phone-to-phone Android upgrade from `1.1.2-preview` without deleting data.
- Native permission checks on Android 13–15 and review of installer failures.

Do not change feature statuses from partial to implemented merely to bypass
`node scripts/platform-sync-preflight.mjs --release`: the **production**
release gate remains blocked while master UI animation parity is partial.
Use a preview update to test incremental progress, not to mislabel completeness.
