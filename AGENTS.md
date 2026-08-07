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

This is the canonical KnowMe repository for the ongoing product and future Nexus integration:

`Tresor562/knowMe_mpv`

Do not substitute `knowMe_secret` for this integration.

## Current unfinished KnowMe work

At the 2026-08-07 checkpoint:

- KMD-057 / PR #101 is open, draft, and must be completed first.
- KMD-058 / PR #102 is open, draft, and depends on KMD-057.

Always re-read their live state because the checkpoint can become stale.

Do not add Nexus integration code to KMD-057 or KMD-058 branches.

## Who performs the Nexus integration

Nexus AI core defines the reusable AI-side contracts and capabilities in `Tresor562/Nexus-Ai-`.

The final app-side integration must be performed against the then-current canonical `knowMe_mpv/main` by the work stream responsible for KnowMe, after the relevant KnowMe core work is stable. This protects the integration from stale assumptions about schemas, permissions, messaging, games, accounts, security, avatars, events, items, themes, and mobile/web behavior.

## Integration branch rule

When integration begins, create dedicated branches from current stable `main`, for example:

`feat/knowme-nexus-integration-*`

Never reuse an unfinished KMD branch.

## Safety and authority

Nexus must not receive unrestricted direct database access. Integrate it through narrow authenticated server-side capabilities with explicit permission scopes, audit logs, idempotency, feature flags, rollback paths, and approval for consequential actions.

## Rule for future instances

If remembered conversation context conflicts with current GitHub state, current GitHub state plus these repository continuity documents win.
