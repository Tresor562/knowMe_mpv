# KMD-346 — Pin the canonical CI status check in release governance

## Problem

KMD-345 made repository governance a mandatory market-release preflight, but its required-status-check validation accepted any non-empty check name as long as strict branch protection was enabled. A repository administrator could therefore configure an unrelated or inert status context and satisfy the guard without requiring KnowMe's actual CI job.

The canonical workflow in `.github/workflows/ci.yml` uses the `quality` job for migrations, build, the root test suite, Web E2E, and API E2E. Release governance must require that concrete status check rather than a generic named context.

## Delivery

- Pin the release-governance preflight to the canonical `quality` status check.
- Continue to require strict/up-to-date status checking.
- Accept the canonical context from either GitHub's legacy `contexts` array or the modern `checks[].context` representation.
- Reject strict branch protection that only requires unrelated or decoy status contexts.
- Keep all KMD-345 repository identity, branch identity, approving-review, administrator-enforcement, conversation-resolution, force-push, and deletion protections unchanged.

## Tests

The governance test suite now covers:

1. the valid canonical `quality` context;
2. fail-closed behavior when strict checking is disabled;
3. rejection of unrelated/deceptive required checks such as `documentation-only` and `noop`;
4. acceptance of `quality` when GitHub exposes it through the modern `checks` collection;
5. all pre-existing repository/branch identity and protection-endpoint failure cases.

The suite remains part of the root `pnpm test` command. Merge only after GitHub Actions is green on the exact PR head and reviews/threads are clear.

## Migration

No Prisma migration, user-data migration, API migration, or evidence-schema migration is required. This changes only the release-governance validation contract.

## Rollback

Revert the KMD-346 commits. No persistent data rollback is required. Reverting would restore KMD-345 behavior, where any named required status check could satisfy the status-check portion of the release guard.

## Operational requirement

This change does not configure GitHub branch protection. An administrator must still protect `Tresor562/knowMe_mpv` `main` and require the canonical `quality` check with strict/up-to-date enforcement, at least one approval, administrator enforcement, conversation resolution, and destructive-ref protections.

## Proof boundary

KMD-346 proves only that the release preflight rejects governance snapshots that do not require the canonical KnowMe CI status context. It does not prove that branch protection is actually configured, that `quality` has passed for a future release commit, or that legal, physical-device, production, restore, monitoring, or store validations have occurred.
