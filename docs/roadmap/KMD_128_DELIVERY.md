# KMD-128 — Mobile archive timeline entrypoint

## Scope

Expose the existing Mobile private archive timeline from the authoritative private conversation organization hub.

This is KnowMe core Mobile only. It does not add or change any API, schema, persistence, authorization, membership, role, messaging side effect, Nexus integration, Premium/KnowCoins behavior, call/device flow, legal gate, or KMD-059 behavior.

## Product behavior

The organization hub gains a `Chronologie des archives` tool. It reuses `ConversationArchiveTimelineExperience`, which reads only the existing `/conversation-archives` and `/conversations` authorities and groups already-accessible personal archive records locally into the existing recent/week/older buckets.

Selecting an archive can reopen the existing per-conversation private organization detail through the hub's existing navigation callback. The timeline itself performs no archive mutation.

## Validation

Required before merge:

- complete monorepo build, including Mobile TypeScript/Expo;
- existing unit suite;
- PostgreSQL API E2E suite;
- standard repository CI green on the PR head;
- diff review confirming no authority widening or unrelated stream changes.

No migration is required because KMD-128 introduces no persistence change.

## Rollback

Remove the `ConversationArchiveTimelineExperience` import, the `archiveTimeline` tool identifier/card, and its render branch from `apps/mobile/src/MessagesOrganizationExperience.tsx`, then remove this delivery document. No database rollback is required.
