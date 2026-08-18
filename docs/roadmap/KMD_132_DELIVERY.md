# KMD-132 — Mobile organization partial-load resilience

## Scope

Keep the Mobile private conversation organization hub usable when one or more optional personal overview collections fail to load, without widening authority or changing existing organization behavior.

This delivery is KnowMe core Mobile only. It does not add or change API routes, persistence, schema, migrations, authorization, membership, roles, message delivery, Nexus core/integration, Premium, KnowCoins, calls, hardware/device behavior, legal gates, OS permissions, or KMD-059.

## Product behavior

`/conversations` remains the required source for the per-conversation organization list. Once conversations load, Mobile requests the existing personal folders, archives, pins and drafts collections in parallel.

If one optional collection fails, the organization hub remains usable: accessible conversations continue to render, successful counters remain visible, and unavailable counters render as an em dash instead of an invented value. A neutral warning explains that only some personal counters are temporarily unavailable.

If `/conversations` itself fails, the existing blocking error behavior remains because the hub cannot safely construct its per-conversation organization list without the authoritative conversation membership response.

No failed request is converted to zero, because zero would falsely claim an authoritative empty collection.

## Validation

Required before merge:

- Mobile TypeScript/Expo build succeeds as part of the complete monorepo build;
- existing repository unit suite succeeds;
- PostgreSQL API E2E succeeds;
- standard repository CI is fully green on the PR head;
- diff review confirms only existing personal endpoints are read;
- a rejected optional overview request cannot erase the already-authorized conversation list or fabricate a zero count;
- no authorization widening, mutation, membership/role change or message side effect is introduced.

No dedicated Mobile test runner exists in the current package. For this narrow client-side resilience change, TypeScript compilation plus the complete repository CI is the adapted regression gate.

No migration is required because there is no persistence change.

## Rollback

Restore `loadOrganization` to the KMD-131 all-or-nothing overview load, remove `overviewWarning`, restore non-null optional counter fields, and remove this delivery document. No database rollback is required.
