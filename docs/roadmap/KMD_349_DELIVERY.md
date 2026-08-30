# KMD-349 — Bind live quality execution to the pinned provider

## Problem

KMD-348 requires branch protection to pin the canonical `quality` required check to a positive GitHub App id. That configuration alone does not prove that the `quality` check which actually ran on the exact release head was produced by that same provider.

A release-governance preflight must fail closed if branch protection pins one provider while the live check run on `main` was produced by another app, ran on a different commit, is incomplete, or did not succeed.

## Delivery

- Read the exact canonical `main` commit SHA from GitHub branch metadata.
- Query GitHub check runs for the canonical `quality` check on that exact SHA.
- Require exactly one provider-pinned `quality` branch-protection entry with a positive `app_id`.
- Require at least one exact-head `quality` check run that is completed, successful, and produced by the same GitHub App id pinned by branch protection.
- Reject missing/invalid branch commit identities, duplicate provider-pinned `quality` entries, mismatched provider ids, stale-head checks, incomplete checks and unsuccessful checks.
- Preserve all existing canonical repository, branch protection, review, admin enforcement, conversation resolution, force-push and deletion safeguards.

## Tests

The governance suite now covers:

1. successful exact-head `quality` from the pinned provider;
2. provider mismatch;
3. stale/different head SHA;
4. unsuccessful quality conclusion;
5. duplicate provider-pinned quality entries;
6. missing branch commit SHA;
7. the four live GitHub reads: repository, branch, protection and exact-head check runs;
8. all existing governance failure cases.

The suite remains part of root `pnpm test` through `scripts/github-release-governance-preflight.test.mjs`.

## Migration

No Prisma migration, user-data migration, API migration or release-evidence schema migration is required.

## Rollback

Revert the KMD-349 commits. No persistent data rollback is required. Reverting restores KMD-348 behavior, which validates provider pinning in configuration but does not bind that provider to the live exact-head check execution.

## Operational requirement

The market-release governance token now also needs read access sufficient for GitHub check runs in addition to repository administration metadata. This remains read-only inspection; KMD-349 does not mutate repository settings or workflow state.

## Proof boundary

KMD-349 proves only that the governance snapshot contains a successful canonical `quality` run on the exact `main` head from the same GitHub App id pinned by branch protection. It does not prove the external app is trustworthy beyond that configured identity, does not configure branch protection, and does not claim legal/privacy review, physical-device validation, production deployment, backup/restore execution, monitoring delivery or store publication.
