# KMD-350 — Pin CI action provenance and minimize workflow token permissions

## Problem

The canonical CI workflow was still invoking `actions/checkout`, `pnpm/action-setup`, and `actions/setup-node` through mutable `v4` tags. A mutable upstream tag can move to different code without any change in the KnowMe repository, weakening reproducibility and creating a supply-chain trust gap in the exact workflow used to validate market-release changes.

The workflow also relied on repository/default GitHub Actions token permissions instead of declaring the least privilege it needs.

## Delivery

- Pin `actions/checkout` to commit `11d5960a326750d5838078e36cf38b85af677262` (the commit referenced by upstream `v4` when reconciled on 2026-08-30).
- Pin `pnpm/action-setup` to commit `b906affcce14559ad1aafd4ab0e942779e9f58b1` (the signed upstream `v4` tag target when reconciled on 2026-08-30).
- Pin `actions/setup-node` to commit `49933ea5288caeca8642d1e84afbd3f7d6820020` (the commit referenced by upstream `v4` when reconciled on 2026-08-30).
- Declare workflow-level `permissions: contents: read` so the default `GITHUB_TOKEN` cannot silently inherit broader write permissions.
- Add a workflow supply-chain regression test and execute it before dependency installation.

## Tests

`scripts/ci-workflow-supply-chain-preflight.test.mjs` verifies that:

1. the CI workflow explicitly grants only `contents: read` at workflow scope;
2. every external `uses:` action is pinned to an exact lowercase 40-character commit SHA;
3. mutable major-version action tags such as `@v4` cannot be reintroduced.

The test is executed directly by the canonical `quality` job before `pnpm install`, so a future workflow edit that weakens these controls fails the same required CI path used for release validation.

## Migration

No Prisma, API, user-data or release-evidence migration is required.

## Rollback

Revert the KMD-350 commits. No data rollback is required. A rollback would intentionally restore mutable action references/default token permission behavior and therefore should only be used as a short-lived emergency measure while replacing the pins with independently verified immutable commits.

## Operational maintenance

Pinned action commits do not update automatically. Future action upgrades must deliberately verify the upstream release/tag target, update the exact SHA in `.github/workflows/ci.yml`, and pass the full `quality` job before merge.

The PostgreSQL service image and dependency-install reproducibility remain separate supply-chain surfaces; KMD-350 does not claim they are fully pinned or reproducible.

## Proof boundary

KMD-350 proves only repository-controlled immutability of the referenced GitHub Action revisions and least-privilege default workflow token permissions. It does not prove the upstream action code itself is free of vulnerabilities, does not attest the hosted runner, does not prove production deployment or store publication, and does not replace legal, privacy, physical-device, backup/restore or monitoring evidence.
