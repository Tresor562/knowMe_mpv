# KMD-348 — Require provider-pinned canonical CI provenance

## Problem

KMD-346 requires the canonical `quality` status-check name, but GitHub branch protection can represent required checks through either legacy `contexts` strings or the finer-grained `checks` collection. A name alone does not make provider provenance explicit. GitHub documents `checks[].app_id` as the GitHub App identity that must provide a required check and documents `app_id: -1` as explicitly allowing any application to set it.

A market-release governance gate should therefore fail closed unless the canonical `quality` check is represented as an application-pinned required check.

## Delivery

- Keep the canonical repository, branch, and `quality` check name pinned.
- Require strict/up-to-date status checking.
- Require `quality` in `required_status_checks.checks` with a positive integer `app_id`.
- Reject legacy `contexts`-only `quality` configuration because it does not expose explicit provider identity to this preflight.
- Reject `quality` entries with a missing `app_id`, zero, a non-integer value, or `-1`.
- Do not hardcode an unverified vendor application ID. The guard proves that GitHub branch protection pins the required provider; repository configuration remains responsible for selecting the actual trusted provider.
- Preserve KMD-345/KMD-346 review, admin-enforcement, conversation-resolution, force-push, branch-deletion, repository identity, and branch identity requirements.

## Tests

The governance suite covers:

1. a provider-pinned `quality` check with a positive application id;
2. rejection of a provider-pinned but unrelated check name;
3. rejection of legacy `contexts`-only `quality`;
4. rejection of `app_id: -1`, which GitHub defines as allowing any app;
5. rejection of a missing application id;
6. acceptance of arbitrary positive provider ids without pretending the code knows an unverified vendor id;
7. all pre-existing repository, branch, review and protection failure cases.

The tests remain in the root `pnpm test` execution through `github-release-governance-preflight.test.mjs`.

## Migration

No Prisma migration, user-data migration, API migration, or release-evidence schema migration is required.

## Rollback

Revert the KMD-348 commits. No persistent data rollback is required. Reverting restores KMD-346 behavior, which pins the `quality` name but can accept a required check without explicit application provenance.

## Operational requirement

This code does not configure branch protection or choose the trusted GitHub App. A repository administrator must configure canonical `main` with strict required checks and a provider-pinned `quality` check. Until the real protection is configured, the market-ready preflight is expected to fail.

## Proof boundary

KMD-348 proves only that the governance validator requires explicit provider pinning in the branch-protection snapshot it receives. It does not prove the identity or trustworthiness of a particular external app, that branch protection is currently enabled, or that legal, physical-device, deployment, restore, monitoring or store validations have occurred.
