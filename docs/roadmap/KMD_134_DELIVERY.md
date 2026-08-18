# KMD-134 — Mobile organization detail authority resilience

## Scope

Harden the Mobile private per-conversation organization detail so that authoritative conversation membership remains the required gate while optional personal organization sources can fail independently without fabricating an empty or zero state.

This delivery is KnowMe core Mobile only. It does not add or change API routes, persistence, schema, migrations, authorization rules, memberships, roles, message delivery, Nexus core/integration, Premium, KnowCoins, calls, hardware/device behavior, legal gates, OS permissions, or KMD-059.

## Product and security behavior

`/conversations` is loaded first and remains the required authority for displaying per-conversation organization state.

- While authority is loading, personal organization cards are not rendered with misleading default values.
- If `/conversations` fails, the detail fails closed and no personal organization cards remain actionable.
- If the requested conversation is no longer present in the authoritative list, the detail reports that it is no longer accessible and does not render the cards.
- Once authority succeeds, folders, drafts, archives, pins and saved-message references load independently.
- A failed optional source renders `Indisponible pour le moment` for that source instead of pretending that the user has no folder, no draft, no archive, no pin, or zero saved messages.
- Optional unavailable cards are disabled while the other successfully loaded personal states remain usable.
- Leaving the component invalidates late async completion through the existing `active` lifecycle guard.

The saved-message count remains explicitly scoped to the existing bounded `/saved-messages?limit=100` response. This milestone does not claim that it is a global authoritative total beyond that contract.

## Validation

Required before merge:

- Mobile TypeScript/Expo build succeeds through the complete monorepo build;
- existing repository unit suite succeeds;
- PostgreSQL API E2E succeeds;
- standard repository CI is fully green on the PR head;
- diff review confirms `/conversations` remains the required authority;
- cards do not render before authority has been established;
- an absent conversation after authority refresh fails closed;
- failure of one optional source does not erase successful sibling sources;
- unavailable optional sources do not render fabricated empty/zero values;
- no endpoint, permission, role, membership or message mutation is introduced.

The Mobile package currently exposes no dedicated component test runner, so the adapted executable gate is Mobile TypeScript compilation inside the full monorepo CI plus the repository unit and PostgreSQL E2E suites. No migration is required because persistence is unchanged.

## Rollback

Restore the previous all-or-nothing organization detail loader and remove `docs/roadmap/KMD_134_DELIVERY.md`. No database rollback is required.
