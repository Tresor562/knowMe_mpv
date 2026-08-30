# KMD-358 — Exact direct JavaScript dependency pins

## Goal

Reduce JavaScript supply-chain drift while the canonical `pnpm-lock.yaml` gap remains unresolved by requiring every direct registry dependency in the KnowMe monorepo to use an exact package version.

This is a compensating reproducibility control, not a replacement for a real lockfile. Transitive dependency resolution is still not fully frozen until a canonical lockfile is generated from PNPM 10.13.1 and committed after full validation.

## Scope

The root, API, Web, Mobile and shared contract package manifests now use exact versions for direct registry dependencies and development dependencies. Internal monorepo links continue to use `workspace:*`.

The CI pre-install supply-chain gate runs `scripts/package-dependency-pinning-preflight.test.mjs` together with the existing CI workflow supply-chain test before `pnpm install`.

The guard rejects caret, tilde, wildcard, comparator and other floating direct registry ranges. It also requires the root `packageManager` declaration to remain an exact PNPM version.

The first exact-head CI attempt (#1247) proved the guard and install path, then correctly failed the unsuppressed production dependency audit. That failure exposed stale security baselines rather than a test defect. The branch therefore upgrades Next.js to 15.5.21, Playwright to 1.55.1 and Multer to 2.2.0, and pins the affected transitive `path-to-regexp` and `lodash` paths to reviewed fixed versions 8.4.2 and 4.18.1. No advisory is ignored or suppressed.

## Validation required before merge

- pre-install CI supply-chain policy tests pass;
- `pnpm install --frozen-lockfile=false` succeeds using the exact direct pins;
- unsuppressed `pnpm audit --prod --audit-level=high` passes;
- Prisma generation and deployed migrations pass;
- schema drift check passes;
- full build and test suite pass;
- Web E2E passes;
- API E2E passes;
- no blocking review or unresolved review thread remains;
- merge must target the exact validated head SHA.

## Migration

No Prisma schema or user-data migration is introduced.

Dependency resolution changes deliberately for direct packages whose previous minimum is no longer security-acceptable. CI is the acceptance boundary for API/build/runtime compatibility.

## Rollback

Revert the KMD-358 merge commit if exact pinning exposes an incompatibility that cannot be corrected safely. Do not roll back to versions known to fail the high/critical production audit, and do not silently restore floating ranges without a reviewed replacement reproducibility strategy.

## Proof boundary

KMD-358 does not claim that dependency resolution is fully reproducible. The repository still lacks a committed canonical `pnpm-lock.yaml`, and transitive resolution can therefore vary. It also does not prove physical-device validation, legal/privacy approval, production restore or monitoring, production deployment, or App Store / Google Play publication.
