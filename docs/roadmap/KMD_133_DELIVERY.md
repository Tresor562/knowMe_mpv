# KMD-133 — Mobile organization authority refresh fail-closed

## Scope

Ensure the Mobile private conversation organization hub never keeps a previously loaded conversation list usable after the authoritative `/conversations` membership refresh fails.

This delivery is KnowMe core Mobile only. It does not add or change API routes, persistence, schema, migrations, authorization rules, memberships, roles, message delivery, Nexus core/integration, Premium, KnowCoins, calls, hardware/device behavior, legal gates, OS permissions, or KMD-059.

## Product and security behavior

`/conversations` remains the required authority for the per-conversation organization list.

When a refresh succeeds, the hub keeps the KMD-132 behavior: conversations remain usable even if one or more optional personal counters fail, and unavailable counters render as `—` rather than a fabricated zero.

When `/conversations` fails, Mobile now clears the previously loaded conversation list, overview counters, partial-load warning and any selected organization conversation before surfacing the blocking error. This prevents stale membership state from remaining actionable after authority revalidation failed.

The change does not claim that a failed refresh means membership was revoked; it only refuses to keep stale membership-derived UI actionable until the authority can be loaded again.

## Validation

Required before merge:

- Mobile TypeScript/Expo build succeeds through the complete monorepo build;
- existing repository unit suite succeeds;
- PostgreSQL API E2E succeeds;
- standard repository CI is fully green on the PR head;
- diff review confirms no endpoint, permission or mutation widening;
- a required `/conversations` failure clears stale conversations and overview state;
- optional overview failures retain the KMD-132 partial-load behavior;
- no membership, role or message mutation is introduced.

The Mobile package currently exposes only the TypeScript build script and no dedicated test runner. For this narrow state-safety change, the adapted executable gate is Mobile TypeScript compilation as part of the full repository CI, plus the repository unit and API E2E suites. No migration is required because persistence is unchanged.

## Rollback

Remove the state clearing from the required authority failure path and remove this delivery document. No database rollback is required.
