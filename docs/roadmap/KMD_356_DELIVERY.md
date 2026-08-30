# KMD-356 — Remove production dependency audit bypasses

## Status

Active delivery candidate. Merge only after the canonical exact-head CI proves that the production dependency graph has no unsuppressed high or critical advisories and all existing quality gates pass.

## Goal

Make production dependency security auditing fail closed. The canonical CI previously ignored two individual GHSA advisories while still running `pnpm audit --prod --audit-level=high`. Those bypasses can silently outlive their justification and weaken the release gate.

KMD-356 removes advisory-specific exceptions and adds a repository policy regression test so future high/critical production advisories must either be fixed in the dependency graph or handled by an explicit new reviewed delivery rather than being silently suppressed in CI.

## Changes

- `.github/workflows/ci.yml`
  - production audit now runs exactly `pnpm audit --prod --audit-level=high`;
  - removes the GHSA-specific `--ignore` exceptions.
- `scripts/ci-workflow-supply-chain-preflight.test.mjs`
  - requires the production audit gate;
  - rejects advisory-specific `--ignore` flags in the canonical workflow;
  - preserves existing runner, GitHub Action, runtime and container-image supply-chain checks.

## Validation required before merge

1. Supply-chain policy preflight passes on the exact PR head.
2. `pnpm install` completes using the repository's configured PNPM version.
3. `pnpm audit --prod --audit-level=high` exits successfully with no advisory bypasses.
4. Prisma generation, deployment migrations and migration drift validation pass.
5. Monorepo build and complete test suite pass.
6. Web Playwright E2E passes.
7. API PostgreSQL-backed E2E passes.
8. No unresolved review thread or merge conflict exists.

If the unsuppressed audit fails, KMD-356 must remain unmerged while the vulnerable dependency path is identified and remediated. Reintroducing an ignore flag merely to make CI green is not an acceptable fix.

## Migration

No Prisma, user-data, API-contract or application-state migration is introduced.

## Rollback

Revert the KMD-356 merge commit only if the audit-policy change itself causes an operationally incorrect gate. A rollback must not be used to conceal a newly detected high/critical advisory; such an advisory requires dependency remediation and a documented security decision.

## Proof boundary

A green exact-head CI proves only that the package registry audit data available during that run reports no unsuppressed high/critical advisories in the resolved production dependency graph. It is not a substitute for broader dependency review, SAST/DAST, penetration testing, legal/privacy review, physical-device validation, production restore evidence, monitoring evidence, deployment evidence or store publication.

## Known remaining reproducibility gap

The repository still has no committed `pnpm-lock.yaml` and installations remain non-frozen. KMD-356 intentionally does not fabricate a lockfile. Dependency-resolution reproducibility remains a separate launch-hardening gap until a canonical lockfile can be generated and validated with `pnpm@10.13.1`.
