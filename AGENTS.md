# Mandatory project continuity instructions

These repository-level instructions apply to any coding assistant, agent, or future ChatGPT session working on KnowMe.

## Read first

Before modifying KnowMe:

1. Read `docs/NEXUS_INTEGRATION_CHECKPOINT.md` completely.
2. Inspect current `main`, open PRs, active branches, and CI live on GitHub.
3. Determine whether the request belongs to:
   - KnowMe core KMD work;
   - Nexus AI core (which belongs in `Tresor562/Nexus-Ai-`);
   - Nexus × KnowMe integration.
4. Never mix those streams in one branch.

## Canonical repository

This is the canonical KnowMe repository for the ongoing product and Nexus integration:

`Tresor562/knowMe_mpv`

Do not substitute `knowMe_secret` for this integration.

## Current reconciled state

The old 2026-08-07 KMD-057/KMD-058 blocker note is obsolete. Live GitHub state always wins, but at the 2026-08-08 reconciliation:

- KMD-057 / PR #101 is merged.
- The old stacked KMD-058 / PR #102 was closed without merge.
- Rebuilt KMD-058 / PR #104 is merged.
- Nexus OS product executor / PR #105 is merged.
- Nexus Social private/group integration / PR #106 is merged.
- Nexus account entitlement integration / PR #107 is merged after build, unit and E2E validation.

Do not recreate these milestones. Inspect `main` and the current checkpoint before starting new work.

## Who performs the Nexus integration

Nexus AI core defines reusable AI-side contracts and capabilities in `Tresor562/Nexus-Ai-`.

Application-side integration belongs in the then-current canonical `knowMe_mpv/main` on a dedicated Nexus integration branch after live-state inspection. This protects the integration from stale assumptions about schemas, permissions, messaging, games, accounts, security, avatars, events, items, themes, Web, and Mobile behavior.

## Integration branch rule

For future Nexus × KnowMe features, create dedicated branches from current stable `main`, for example:

`feat/knowme-nexus-integration-*`

Never reuse old KMD or unrelated product branches.

## Entitlement rule

Private Nexus chat in KnowMe has a bounded free baseline for every authenticated KnowMe user. Linking a Nexus account may unlock additional capabilities and quotas according to Nexus-authoritative Free / Plus / Pro / Business entitlements.

- KnowMe client code must never invent or elevate a Nexus plan.
- Entitlement resolution is server-to-server and minimal.
- Stale paid authorization must fail down rather than remain elevated.
- Safety, privacy, approvals, audit, idempotency, secret protection, and OS/device consent are never premium and remain enforced for every plan.

## Safety and authority

Nexus must not receive unrestricted direct database access. Integrate it through narrow authenticated server-side capabilities with explicit permission scopes, audit logs, idempotency, feature flags, rollback paths, and approval for consequential actions.

## Rule for future instances

If remembered conversation context conflicts with current GitHub state, current GitHub state plus these repository continuity documents win. Update the checkpoint deliberately when project state changes materially.
