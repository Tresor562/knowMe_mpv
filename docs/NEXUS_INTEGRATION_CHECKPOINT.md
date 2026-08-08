# KnowMe × Nexus AI — mandatory integration checkpoint

Last reconciled: 2026-08-08.

Live GitHub state always wins over this document.

## Canonical repositories

- KnowMe: `Tresor562/knowMe_mpv`
- Nexus AI: `Tresor562/Nexus-Ai-`
- `knowMe_secret` is not the target repository for this integration.

Never mix KnowMe core, Nexus core, and Nexus × KnowMe integration in the same feature branch.

## Current reconciled KnowMe state

The old KMD-057/KMD-058 blocker sequence is complete and must not be recreated.

- PR #99 — KMD-056 authoritative tournaments: merged.
- PR #101 — KMD-057 authoritative persistent call lifecycle: merged.
- PR #102 — old stacked KMD-058 branch: closed without merge after KMD-057 landed.
- PR #104 — rebuilt KMD-058 secure ephemeral TURN credentials: merged after validation.
- PR #105 — Nexus OS capability executor: merged. KnowMe exposes narrow server-authenticated Nexus capability execution with scopes, kill switch, idempotency and receipts rather than unrestricted database access.
- PR #106 — Nexus Social messaging integration: merged. KnowMe supports explicit private Nexus conversations and group responses only when a current participant explicitly invokes `@Nexus`; assistant output remains distinct from human messages and delivery is revalidated by KnowMe.
- PR #107 — Nexus account entitlements: merged. Every authenticated KnowMe user has a bounded private Nexus baseline without linking a Nexus account; a linked Nexus account unlocks Nexus-authoritative Free / Plus / Pro / Business capabilities and quotas.

PR #107 was not merged on first implementation. CI first exposed TypeScript unsafe optional entitlement access. After correction, the build passed but the new quota unit test exposed an invalid exception assertion/runtime export assumption. That was corrected to an explicit HTTP 429 contract. Final validation passed build, the complete unit suite, and API E2E before merge.

## Nexus account entitlement architecture

### Unlinked KnowMe user

Every authenticated KnowMe user can use private Nexus chat at a bounded free baseline without linking a Nexus account.

The baseline is intentionally limited and does not grant paid Nexus capabilities.

### Linked Nexus account

Linking is server-to-server. KnowMe stores only minimal association/last-verified entitlement metadata. Nexus remains the subscription authority.

Supported product plan names:

- `free`
- `plus`
- `pro`
- `business`

KnowMe client code must never choose, set, or elevate a Nexus plan. Paid authorization is refreshed from Nexus server-to-server. If a stale paid profile cannot be revalidated, authorization fails down instead of preserving stale paid access.

### Safety is never premium

Plan upgrades may increase model modes, quotas, context limits, and other product capabilities, but they never bypass:

- privacy boundaries;
- Safety Kernel policy;
- permission checks;
- audit requirements;
- idempotency requirements;
- secret protection;
- explicit approval for consequential external writes;
- local device confirmation;
- operating-system permissions/consent.

## Division of responsibility

### Nexus AI core

Repository: `Tresor562/Nexus-Ai-`

Owns reusable AI-side systems such as model routing, entitlement contracts, memory, research, agents, safety, tools/plugins, SDK/API, provider adapters, observability, and device protocols.

### KnowMe product

Repository: `Tresor562/knowMe_mpv`

Owns application-side schemas, authorization, accounts, messaging, groups, games, moderation, security, avatars, events, items, themes, Web, and Mobile behavior.

Future Nexus × KnowMe features must start from the then-current `knowMe_mpv/main` on a dedicated branch such as `feat/knowme-nexus-integration-*`.

## Required architecture for future integrations

1. Start from current stable `main` after inspecting live PRs/CI.
2. Use narrow authenticated server-side capabilities; never give Nexus unrestricted direct database or shell access.
3. Separate read, write, moderation, destructive and administrative scopes.
4. Require explicit approval for consequential operations.
5. Use audit logs, actor attribution, idempotency keys and immutable receipts where appropriate.
6. Keep feature flags, kill switches and rollback paths.
7. Keep all provider/service secrets server-only.
8. Validate user, tenant, conversation and role boundaries server-side.
9. Test unit, integration, E2E, abuse/security, concurrency, migrations, Web and Mobile as relevant before rollout.
10. Roll out progressively rather than granting broad autonomous authority.

## Restart protocol

1. Read `/AGENTS.md` and this file.
2. Inspect live `main`, open PRs, active branches and CI.
3. Identify the stream: KnowMe core, Nexus core, or Nexus × KnowMe.
4. Never recreate merged milestones.
5. Never trust old failure notes without checking the current head.
6. Keep Nexus subscription authority server-side and minimal in KnowMe.
7. Reconcile this checkpoint whenever project state changes materially.

## Cross-repository continuity

The Nexus repository contains its own `AGENTS.md` and `docs/PROJECT_CONTINUITY.md`. Read both before cross-repository work.
