# KnowMe × Nexus AI — mandatory integration checkpoint

Last reconciled: 2026-08-07, Africa/Porto-Novo.

This document is a durable handoff for any future ChatGPT instance, coding agent, or maintainer. Read it before resuming KnowMe or integrating Nexus AI.

## Canonical repositories

- KnowMe: `Tresor562/knowMe_mpv`
- Nexus AI: `Tresor562/Nexus-Ai-`
- `knowMe_secret` is not the target repository for this Nexus integration.

## Current KnowMe state at the checkpoint

### KMD-056

- authoritative single-elimination tournaments
- PR #99
- already merged into `main`

### KMD-057 — unfinished

- PR #101
- title: `feat(KMD-057): authoritative persistent call lifecycle`
- state at checkpoint: open, draft, mergeable, not merged
- base: `main`
- head: `feat/kmd-057-authoritative-call-lifecycle-clean`
- head SHA at checkpoint: `ea11a5841d33e9cdcd0bf0813c7037ff77878fbc`

Scope includes server-issued call IDs, authoritative RINGING/ACTIVE/terminal states, server-authorized signaling, shared-conversation requirements, one active call per participant, idempotency/anti-spam, authoritative expiry/missed calls, minimized call history, audit/export/deletion primitives, and privacy rules excluding persisted SDP/ICE/network addresses.

Historical validation note: an older E2E assertion was too broad around words such as `offer` and `candidate`. The intended test should reject actual sensitive fields such as `offer`, `answer`, `candidate`, `sdp`, and `ipAddress`, while allowing safe governance indicators such as `iceCandidatesPersisted: false`. Do not assume this failure still exists: inspect the current head and CI first.

### KMD-058 — unfinished and dependent on KMD-057

- PR #102
- title: `feat(KMD-058): secure ephemeral TURN credentials`
- state at checkpoint: open, draft, mergeable, not merged
- base: `feat/kmd-057-authoritative-call-lifecycle-clean`
- head: `feat/kmd-058-secure-turn-credentials`
- head SHA at checkpoint: `6f5b9a8a8b98d90cb3e1f60a3429f940e6918783`

Scope includes server-controlled ICE configuration, ephemeral TURN REST HMAC-SHA1 credentials, bounded TTL, server-only TURN secret, no credential persistence, production fail-closed policy when TURN is required, per-user/per-call issuance rate limiting, audit fingerprinting, Web ICE consumption, cryptographic tests, and rotation documentation.

## Mandatory KnowMe resume order

1. Inspect current `main` and the current delivery ledger/specification.
2. Inspect PR #101 live: head, diff, comments, CI, mergeability.
3. Finish KMD-057 and obtain the required green builds/tests/E2E before merge.
4. Merge KMD-057 only after validation.
5. Rebase/rebuild/retarget KMD-058 onto the canonical merged KMD-057 state if necessary.
6. Inspect and validate PR #102 fully.
7. Merge KMD-058 only after green validation.
8. Continue KMD-059+ only after reconciling the canonical ledger with `main`.

## Nexus integration must not enter those branches

Do not add Nexus AI integration code to:

- `feat/kmd-057-authoritative-call-lifecycle-clean`
- `feat/kmd-058-secure-turn-credentials`

They are KnowMe core call-infrastructure branches and must remain auditable in their own scope.

## Division of responsibility

### Nexus AI work stream

Repository: `Tresor562/Nexus-Ai-`

Responsible for reusable AI-side contracts and capabilities such as:

- model routing;
- memory and personalization contracts;
- research;
- agents;
- safety/risk classification;
- tool schemas;
- Nexus SDK/API;
- provider adapters;
- observability contracts;
- device/desktop/mobile agent protocols;
- permission and approval contracts.

### KnowMe work stream

Repository: `Tresor562/knowMe_mpv`

Responsible for the final application-side integration because it owns the current schemas, API, permissions, accounts, messaging, groups, games, security, avatars, events, items, themes, Web and Mobile behavior.

The integrating instance must first read this file and inspect live KnowMe state. It must not integrate from a stale remembered architecture.

## Future Nexus × KnowMe requirements

The requested product integration eventually includes:

- private Nexus conversations for KnowMe users;
- Nexus participating in group chats when explicitly invoked/mentioned;
- app-management assistance;
- account-management assistance;
- security monitoring and defensive response assistance;
- game administration/creation assistance;
- avatar workflows;
- seasonal events;
- item creation;
- theme creation;
- moderation/community support;
- repeated pre-release verification before enabling changes in production.

These are future integration requirements, not authorization to bypass KnowMe's existing permission model.

## Required integration architecture

When integration begins:

1. Start from then-current stable `knowMe_mpv/main`.
2. Use dedicated branches such as `feat/knowme-nexus-integration-*`.
3. Give Nexus narrow authenticated server-side capabilities, not unrestricted database access.
4. Define independent permission scopes for domains such as accounts, games, events, items, themes, avatars, security, moderation, messaging, and groups.
5. Separate read, write, moderation, destructive, and administrative operations.
6. Require explicit approval for consequential operations.
7. Use audit logs, idempotency keys, actor attribution, and immutable action receipts.
8. Put integrations behind feature flags and kill switches.
9. Provide rollback paths for schema/config/content changes.
10. Keep all provider/service secrets server-only.
11. Validate tenant/user boundaries and authorization server-side.
12. Test unit, integration, E2E, security, abuse, concurrency, migration, Web, and Mobile behavior before rollout.
13. Roll out progressively rather than enabling broad autonomous authority immediately.

## Restart protocol for any future ChatGPT/agent

Before changing code:

1. Read `/AGENTS.md`.
2. Read this document completely.
3. Inspect live GitHub state.
4. Determine whether the request is KnowMe core, Nexus core, or integration.
5. Compare live state with this checkpoint.
6. If they differ, live GitHub state wins and this checkpoint should be updated deliberately.
7. Never recreate merged work.
8. Never merge stacked dependencies out of order.
9. Never assume an old CI failure is still current without checking.
10. Never use a different KnowMe repository merely because an old conversation mentioned one.

## Cross-repository continuity

The Nexus repository contains its own continuity instructions (`AGENTS.md` and `docs/PROJECT_CONTINUITY.md`). When doing integration work, read both repositories' continuity instructions before coding.
