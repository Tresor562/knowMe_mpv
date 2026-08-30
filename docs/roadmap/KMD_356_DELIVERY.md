# KMD-356 — Remove production dependency audit bypasses

## Status

Active delivery candidate. Merge only after the canonical exact-head CI proves that the production dependency graph has no unsuppressed high or critical advisories and all existing quality gates pass.

## Goal

Make production dependency security auditing fail closed. The canonical CI previously ignored two individual GHSA advisories while still running `pnpm audit --prod --audit-level=high`. Those bypasses can silently outlive their justification and weaken the release gate.

KMD-356 removes advisory-specific exceptions and requires actual dependency remediation instead of suppressing findings.

## Failure-driven remediation

The first exact-head CI attempt (#1240) correctly failed at the unsuppressed production audit. The resolved vulnerable path was:

`apps/mobile > react-native > @react-native/community-cli-plugin > metro > image-size`

The two high-severity findings were `GHSA-w3rx-r6r6-pgpr` and `GHSA-5p2g-fcmc-qvqq`. As of 2026-08-30, the original `image-size` package has no published patched version for these advisories and its GitHub repository is archived.

Instead of restoring audit ignores, KMD-356 replaces Metro's compatible `image-size` 1.x transitive resolution with the maintained MIT compatibility fork `image-size-next@1.2.2` via an exact PNPM override:

`"image-size": "npm:image-size-next@1.2.2"`

The fork is not the original maintainer's package. This substitution is therefore a deliberate supply-chain decision and is accepted only if the exact-head CI proves installation, audit, build, unit tests and E2E compatibility. The override is pinned to an exact package version and guarded by a repository regression test.

## Changes

- `.github/workflows/ci.yml`
  - production audit now runs exactly `pnpm audit --prod --audit-level=high`;
  - removes the GHSA-specific `--ignore` exceptions.
- `package.json`
  - replaces transitive `image-size` with exact `npm:image-size-next@1.2.2` through `pnpm.overrides`.
- `scripts/ci-workflow-supply-chain-preflight.test.mjs`
  - requires the production audit gate;
  - rejects advisory-specific `--ignore` flags in the canonical workflow;
  - requires the exact reviewed Metro compatibility override;
  - preserves existing runner, GitHub Action, runtime and container-image supply-chain checks.

## Validation required before merge

1. Supply-chain policy preflight passes on the exact PR head.
2. `pnpm install` completes using the repository's configured PNPM version and resolves the compatibility override.
3. `pnpm audit --prod --audit-level=high` exits successfully with no advisory bypasses.
4. Prisma generation, deployment migrations and migration drift validation pass.
5. Monorepo build and complete test suite pass, including mobile TypeScript/model tests.
6. Web Playwright E2E passes.
7. API PostgreSQL-backed E2E passes.
8. No unresolved review thread or merge conflict exists.

If the unsuppressed audit still fails, KMD-356 must remain unmerged while the vulnerable dependency path is remediated. Reintroducing an ignore flag merely to make CI green is not an acceptable fix.

## Migration

No Prisma, user-data, API-contract or application-state migration is introduced. Dependency resolution changes for any install performed after this commit; because the repository still lacks a canonical lockfile, exact resolution must continue to be observed in CI until the separate lockfile gap is closed.

## Rollback

Revert the KMD-356 merge commit to restore the previous dependency resolution and audit configuration. A rollback must not be used to conceal a high/critical advisory; if compatibility problems require removing the fork override, the market release must remain blocked until another safe remediation is validated.

## Proof boundary

A green exact-head CI proves that the package registry audit data available during that run reports no unsuppressed high/critical advisories in the resolved production dependency graph and that the substituted Metro dependency passes repository build/test/E2E gates. It does not prove the fork independently secure, nor does it replace source review, SAST/DAST, penetration testing, physical mobile builds, legal/privacy review, production restore evidence, monitoring evidence, deployment evidence or store publication.

## Known remaining reproducibility gap

The repository still has no committed `pnpm-lock.yaml` and installations remain non-frozen. KMD-356 intentionally does not fabricate a lockfile. Dependency-resolution reproducibility remains a separate launch-hardening gap until a canonical lockfile can be generated and validated with `pnpm@10.13.1`.
