# KMD-182 — Public legal release gate

## Goal

Prevent a market release from passing the production preflight when the operator has not configured public HTTPS resources for KnowMe's privacy policy, terms, and account-deletion flow.

This is a release-readiness gate only. It does **not** claim that any legal text has been reviewed, is jurisdictionally sufficient, or that an app-store submission has been accepted.

## Delivered

`pnpm check:release` now requires three public HTTPS URLs:

- `PUBLIC_PRIVACY_POLICY_URL`;
- `PUBLIC_TERMS_URL`;
- `PUBLIC_ACCOUNT_DELETION_URL`.

The URLs must be syntactically valid, use HTTPS, and must not point to localhost or another local development host. `.env.example` documents the variables and makes clear that their real content must be published and reviewed before a store submission.

The account-deletion resource is separate from merely having an in-app deletion control. KnowMe already has authenticated account data-rights functionality; the production operator must also expose a stable Web resource that users can reach outside the installed app to initiate the deletion journey.

## Store-policy context

As checked against the official platform documentation on 2026-08-22:

- Apple requires a public privacy-policy URL for iOS apps in App Store Connect. A privacy-choices URL is optional, but can point users to data access/deletion controls.
- Google Play requires a privacy-policy link in Play Console and in the app. For apps that support account creation, Google Play also requires an in-app deletion path and an external Web resource where users can request deletion of the account and associated data.

These platform rules can change. Store submission must re-check the then-current Apple and Google requirements rather than treating this KMD as permanent legal certification.

## Validation

The release-preflight unit suite covers:

1. a hardened environment with all three public legal URLs;
2. missing privacy, terms, and account-deletion URLs;
3. an HTTP privacy URL;
4. a localhost terms URL;
5. a malformed account-deletion URL.

The full repository merge gate remains unchanged: dependency audit, Prisma generation, clean migration deploy, drift verification, build, unit tests, Chromium Web E2E, and PostgreSQL API E2E must pass on the exact PR head.

## External evidence still required

Do not mark legal/store readiness complete until there is real evidence that:

- the privacy policy accurately describes KnowMe's actual data collection, use, sharing, retention, processors, security practices, user rights, contact path, and any age/territory rules;
- the terms of service have been reviewed for the launch jurisdictions;
- the three configured URLs are publicly reachable over the production domain and remain stable without authentication where the policy itself must be public;
- the external deletion resource actually lets an account holder initiate the deletion journey and accurately explains any lawful retention exceptions;
- App Store Connect privacy disclosures and Google Play Data safety answers match the shipped application and third-party SDKs;
- any child-safety, age-assurance, payments, gambling/competition, communications, or other regulated product areas receive their own required review.

## Rollback

Revert KMD-182 to remove the three configuration checks. This does not remove any legal or store obligation. A rollback must never be used to ship with missing or inaccessible privacy/deletion resources; if the URLs are unavailable, the release should remain blocked until the public resources are restored or replaced.