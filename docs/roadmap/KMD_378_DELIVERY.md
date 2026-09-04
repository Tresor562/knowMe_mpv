# KMD-378 — Derived media authority download fence

Date: 2026-09-02

## Goal

Repair the authorization regression exposed after KMD-377 and keep durable download-token authority aligned with every authorization path implemented by `MediaService.authorizedAsset()`.

KMD-377 correctly made explicit `MediaAccessGrant` revocation a database serialization boundary, but its new `MediaDownloadGrant` trigger accepted only owners and active explicit grants. KnowMe also intentionally authorizes non-owner access through active `CONVERSATION` membership and accepted `FRIENDS` relationships. Without this repair, those legitimate users can pass application authorization and then fail when PostgreSQL persists the download token.

## Implementation

Migration `20260902001000_kmd_378_media_derived_authority_download_fence` replaces the KMD-377 download-authority guard so it accepts exactly these current authorities for an active asset:

1. asset owner;
2. active explicit `MediaAccessGrant`;
3. current membership in the asset conversation when `visibility = CONVERSATION`;
4. an accepted friendship with the owner when `visibility = FRIENDS`.

The guard locks the active `MediaAsset` first and then the authority row used for the decision. This keeps the lock order compatible with the existing media fence.

KMD-378 also adds durable cleanup when derived authority disappears:

- deleting a `ConversationMember` purges matching conversation-derived download tokens unless another active explicit media grant remains;
- changing an accepted friendship to a non-accepted state purges matching friend-derived download tokens unless another active explicit media grant remains;
- deleting an accepted friendship applies the same cleanup.

This preserves alternate explicit authority rather than invalidating tokens unnecessarily.

## Security and compatibility invariant

A legitimate FRIENDS or CONVERSATION user can persist a download token while the corresponding derived authority is current.

After derived authority removal commits, no token that relies only on that authority may remain or be newly persisted.

For concurrent membership removal and token creation, both safe orderings are covered:

- token-first: removal waits for the locked membership row, then purges the committed token;
- removal-first: token creation waits, observes the missing membership after commit and fails closed.

Existing content reads continue to re-check `authorizedAsset()`; the database invariant strengthens durable authority and does not replace application authorization.

## Tests

`apps/api/test/media-derived-authority-download-fence.e2e-spec.ts` proves against PostgreSQL that:

- FRIENDS-derived token creation succeeds while friendship is accepted;
- loss of friendship purges the token and blocks new token persistence;
- CONVERSATION-derived token creation succeeds while membership exists;
- membership removal purges the token and blocks new token persistence;
- an active explicit grant preserves a token when FRIENDS-derived authority disappears;
- membership-removal-first concurrency blocks then rejects token persistence;
- token-first concurrency blocks membership removal until issuance commits, then removal purges the token.

Canonical CI and Runtime readiness must pass on the exact PR head before merge.

## Migration / data impact

No Prisma datamodel field is added.

The migration only replaces/creates PostgreSQL functions and triggers. Purges affect short-lived `MediaDownloadGrant` authorization artifacts only; no media object or `MediaAsset` row is deleted.

## Rollback

If rollback is required, use a dedicated forward migration that restores the prior download-authority function and removes the two KMD-378 derived-authority purge trigger families. Do not recreate tokens already purged by an authority-loss event.

KMD-376 asset-tombstone fencing and KMD-377 explicit-access revocation fencing must remain in place.

## Proof boundary

This delivery can prove repository behavior only after exact-head CI/runtime-readiness succeeds. It does not prove production migration execution, production object-storage behavior, legal/privacy review, physical-device validation, production deployment/monitoring/backup evidence, branch-protection compliance, or store publication.
