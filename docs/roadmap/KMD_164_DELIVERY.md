# KMD-164 — Web account data rights

## Scope

KnowMe core Web privacy/account controls only. This milestone makes the existing authoritative account export and deletion capabilities discoverable and usable from the authenticated Web product without weakening their server-side security boundaries.

## Product contract

- the dashboard exposes a direct `Mes données` entrypoint;
- the authenticated `/account/data-rights` page offers export and account deletion;
- both operations require explicit password reauthentication through `POST /security/reauthenticate` before the sensitive account endpoint is called;
- accounts with 2FA may provide the required TOTP or recovery code as part of that proof;
- the one-time `x-reauth-token` is sent only to the immediately following sensitive request;
- export downloads the server-authoritative JSON response locally and does not persist it in Web application storage;
- deletion requires the literal confirmation `SUPPRIMER` in addition to the server-required password;
- after successful deletion, the Web client clears access/refresh credentials and the trusted-device token before redirecting to login;
- the Web client does not reinterpret, omit, broaden, or synthesize account-export fields: export authority remains server-side.

## Existing server authority reused

- `GET /account/export` remains protected by `JwtAuthGuard` plus `SensitiveActionGuard`;
- `DELETE /account` remains protected by the same guards and still requires the password DTO;
- `POST /security/reauthenticate` issues a short-lived, session-bound, single-use proof and enforces the second factor when 2FA is active;
- Nexus Social export/purge remains part of the existing account controller orchestration.

## Validation required before merge

- complete monorepo build;
- complete unit suite;
- Chromium Web E2E including the authenticated data-rights page and its disabled/enabled destructive-action gates;
- complete PostgreSQL API E2E suite, preserving existing export/deletion/security coverage;
- focused review confirming no sensitive token or exported payload is persisted by the new Web flow;
- no unresolved security/review blocker.

## Migration

None. KMD-164 introduces no schema or persistence change.

## Rollback

Remove `/account/data-rights`, remove the dashboard entry, and remove the KMD-164 browser assertion. Existing API export/deletion/security behavior remains unchanged, so no database rollback is required.

## Explicit non-claims

This milestone does not claim that legal/privacy-policy wording has been approved in every launch jurisdiction, that store privacy declarations are complete, or that deletion/export behavior has been physically validated on every supported device/browser. Those remain release-evidence gates outside CI.
