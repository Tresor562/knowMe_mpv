# KMD-185 — Mobile production API endpoint gate

## Goal

Prevent a production mobile binary from silently using a development API endpoint or an unsafe cleartext endpoint when `EXPO_PUBLIC_API_URL` is missing or misconfigured.

## Delivered

- EAS `build.production` is explicitly bound to the EAS `production` environment.
- `mobile-release-preflight` rejects a production profile that points at another EAS environment.
- Mobile API configuration now fails closed outside development when `EXPO_PUBLIC_API_URL` is missing.
- Production mobile API URLs must be valid absolute HTTPS URLs.
- Production mobile API URLs reject localhost, loopback, Android emulator host `10.0.2.2`, embedded credentials, query strings, and fragments.
- Development retains the existing Android emulator fallback and accepts HTTP/HTTPS for local work.
- Trailing slashes are normalized so API route concatenation remains stable.

## Validation

Repository validation must include:

1. dependency installation and production dependency audit;
2. Prisma generation;
3. `pnpm db:migrate:deploy` on clean PostgreSQL 16;
4. Prisma zero-drift comparison;
5. full monorepo build, including the Mobile TypeScript compilation of `resolveApiUrl`;
6. unit tests, including the EAS production-environment preflight regression case;
7. Chromium Web E2E;
8. PostgreSQL API E2E.

A real EAS production build remains external evidence. Before producing a store binary, the EAS `production` environment must contain the real public `EXPO_PUBLIC_API_URL` for the deployed KnowMe API.

## Operational checks before store build

- Configure `EXPO_PUBLIC_API_URL` in the EAS production environment, not in source control.
- Use the final HTTPS API origin intended for mobile clients.
- Verify TLS and the deployed `/health/ready` endpoint from outside the hosting network.
- Build a production binary and confirm authentication, refresh, account recovery, data export/deletion, messaging and calls against that exact API origin on physical supported devices.

## Privacy and security boundaries

`EXPO_PUBLIC_API_URL` is public application configuration, not a secret. No credential should be placed in an `EXPO_PUBLIC_*` variable. Server secrets remain in server-side secret storage only.

This KMD does not claim that DNS, TLS, EAS environment values, signing credentials, hardware tests, store upload, review, or approval have been validated.

## Rollback

If this change blocks development unexpectedly, keep the fail-closed production behavior and correct the development environment or explicit `EXPO_PUBLIC_API_URL`. Reverting to an unconditional local fallback in production is not an acceptable rollback because it can ship a nonfunctional or insecure store binary.
