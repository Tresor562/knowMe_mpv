# KMD-357 — Upgrade pinned CI actions to Node 24 runtimes

## Status

Active delivery candidate. Merge only after exact-head CI is green and review/thread gates are clear.

## Goal

Remove KnowMe's dependency on GitHub Actions implementations that target the deprecated Node.js 20 action runtime while preserving immutable commit pinning.

The canonical CI had already been supply-chain hardened by pinning action references to exact commits, but those commits belonged to v4 action lines that declare Node.js 20. GitHub is already forcing affected JavaScript actions onto Node.js 24 and has announced removal of Node.js 20 runner support. Leaving the old commits pinned therefore creates avoidable CI drift and future failure risk.

## Upstream verification performed on 2026-08-30

The following upstream v6 release refs were resolved before changing the workflow:

- `actions/checkout@v6` -> commit `d23441a48e516b6c34aea4fa41551a30e30af803`; its `action.yml` declares `runs.using: node24`.
- `actions/setup-node@v6` -> commit `249970729cb0ef3589644e2896645e5dc5ba9c38`; its `action.yml` declares `runs.using: node24`.
- `pnpm/action-setup@v6` -> signed annotated tag object `f520eceda224fe1a4aed5a2a27a194379a409996`, verified by GitHub, pointing to commit `0977fd99725f1db4007ccb2928dbb4e90d06cc86`; its `action.yml` declares `runs.using: node24`.

The workflow pins the resolved commit SHAs, not the mutable `v6` tags.

## Changes

- `.github/workflows/ci.yml`
  - upgrades checkout, PNPM setup and Node setup to their reviewed v6 Node 24 commits;
  - retains exact immutable SHA references;
  - retains `ubuntu-24.04`, `contents: read`, exact Node 22.23.2 for application commands, PostgreSQL digest pinning, strict dependency audit, migrations, build, tests and E2E gates.
- `scripts/ci-workflow-supply-chain-preflight.test.mjs`
  - keeps the generic exact-SHA requirement;
  - now also requires the exact reviewed commit for every external CI action;
  - fails if an unexpected external action is added without review.

## Validation required before merge

1. Supply-chain policy preflight passes on the exact PR head.
2. All three Node 24 actions initialize successfully on `ubuntu-24.04`.
3. PNPM 10.13.1 installation and dependency resolution succeed.
4. Strict high/critical production dependency audit succeeds without exceptions.
5. Prisma generation, migration deploy and schema drift verification succeed.
6. Monorepo build and complete tests succeed.
7. Web Playwright E2E succeeds.
8. API PostgreSQL-backed E2E succeeds.
9. No unresolved review thread or merge conflict exists.

## Migration

No Prisma, user-data, API-contract or application-state migration is introduced.

## Rollback

Revert the KMD-357 merge commit to restore the previous action commits. Because those commits target the deprecated Node 20 action runtime, a rollback should be treated as temporary and the release should not be considered durable until a supported action runtime is restored.

## Proof boundary

A green exact-head CI proves that these exact action commits work for the repository's canonical workflow at that time. It does not make GitHub-hosted runner infrastructure immutable and does not prove application behavior on physical devices, legal/privacy approval, production restore/monitoring/deployment evidence, or store publication.

## Known remaining reproducibility gap

The repository still has no committed `pnpm-lock.yaml` and installs remain non-frozen. KMD-357 does not claim to solve dependency-resolution reproducibility.
