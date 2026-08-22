# KMD-191 — Guest Identity security and privacy baseline

## Phase

Play for Everyone — Guest Play foundation.

## Goal

Create the minimum server-side identity boundary required for future value-before-registration flows without yet allowing anonymous gameplay or weakening the authoritative Game Platform.

## Delivered

- adds a dedicated `GuestIdentity` PostgreSQL model and deployable Prisma migration;
- issues 256-bit opaque guest credentials prefixed with `kg_`;
- persists only SHA-256 credential hashes, never the raw bearer token;
- makes guest identities expire after 24 hours;
- stores only optional public alias, locale, consent version, age-gate state and lifecycle timestamps/status;
- adds `POST /guest/sessions` for bounded guest creation;
- adds `GET /guest/session` for authenticated guest resume;
- adds `DELETE /guest/session` for explicit revocation;
- adds `GET /guest/policy` so clients can see that gameplay and conversion are still disabled;
- adds endpoint-specific throttling in addition to the global API rate limit;
- adds unit coverage for token shape, hashing, expiry, revocation and projection boundaries;
- adds PostgreSQL E2E coverage for create/resume/revoke and malformed-input fail-closed behavior.

## Data minimization

KMD-191 intentionally does **not** store:

- email address;
- phone number;
- real name;
- contacts;
- precise location;
- private conversations;
- long-term game history;
- advertising identifiers;
- raw guest tokens.

`convertedUserId` and conversion timestamps exist only as lifecycle fields for a later, explicit conversion KMD. No conversion endpoint exists yet.

## Security boundaries

- guest credentials are independent from JWT user sessions;
- a guest token cannot authenticate user/account/social endpoints;
- revoked, expired, blocked or converted identities fail with the same generic unauthorized response;
- malformed bearer credentials fail closed before database authority is granted;
- Game Platform scores, winners, rewards, rating and economy remain user/server-authoritative and unchanged;
- age-gate state `UNKNOWN` may exist at this identity stage, but KMD-191 grants it no gameplay rights.

## Retention boundary

Expiry immediately removes authorization value, but this KMD does **not** claim that an expired database row is physically purged on a timer. A later Guest Play KMD must add a tested retention/purge job before guest gameplay is publicly enabled. Explicit `DELETE /guest/session` revokes immediately but likewise does not pretend to be physical erasure of the audit-minimal row.

This limitation is deliberate: KnowMe must not claim a privacy deletion guarantee without a deployed cleanup mechanism and observable proof.

## Migration

Migration:

`20260822210000_kmd_191_guest_identity`

It creates the guest age-gate/status enums, `GuestIdentity`, its unique token-hash index and lifecycle indexes.

## Validation gate

Before merge, the exact PR head must pass:

1. production dependency audit;
2. Prisma generation;
3. clean `prisma migrate deploy` on PostgreSQL 16;
4. zero Prisma drift;
5. complete monorepo build;
6. unit tests, including Guest Identity security tests;
7. Chromium Web E2E;
8. PostgreSQL API E2E, including the new guest lifecycle suite.

No physical-device, legal, parental-consent-provider or store validation is claimed.

## Rollback

Application rollback: revert the KMD-191 merge and remove the Guest Play module from `AppModule`.

Database rollback is destructive and must not be automated after guest rows exist. Before public traffic, the migration can be reversed only by explicitly dropping `GuestIdentity`, then `GuestIdentityStatus` and `GuestAgeGateState`. After real traffic, use a reviewed forward migration instead of silently deleting guest lifecycle data.

## Required follow-up before public Guest Play

The next Guest Play blocks must separately prove:

- automatic physical purge/retention of expired guest rows;
- guest-to-account conversion semantics and one-time transfer rules;
- legal/age-gate behavior by region;
- abuse controls stronger than generic throttling when gameplay is enabled;
- which games are guest-safe;
- guest participation without turning client state into score/winner authority;
- Web Instant Game UX and account-creation prompts only after value has been delivered.
