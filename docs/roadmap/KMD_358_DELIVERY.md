# KMD-358 — Exact direct JavaScript dependency pins

## Goal

Reduce JavaScript supply-chain drift while the canonical `pnpm-lock.yaml` gap remains unresolved by requiring every direct registry dependency in the KnowMe monorepo to use an exact package version.

This is a compensating reproducibility control, not a replacement for a real lockfile. Transitive dependency resolution is still not fully frozen until a canonical lockfile is generated from PNPM 10.13.1 and committed after full validation.

## Scope

The root, API, Web, Mobile and shared contract package manifests now use exact versions for direct registry dependencies and development dependencies. Internal monorepo links continue to use `workspace:*`.

The CI pre-install supply-chain gate runs `scripts/package-dependency-pinning-preflight.test.mjs` together with the existing CI workflow supply-chain test before `pnpm install`.

The guard rejects caret, tilde, wildcard, comparator and other floating direct registry ranges. It also requires the root `packageManager` declaration to remain an exact PNPM version.

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

Dependency resolution may change relative to previous floating ranges because the direct dependencies are deliberately pinned to the versions already expressed as each range's current minimum/declared version. CI is the acceptance boundary for compatibility.

## Rollback

Revert the KMD-358 merge commit if exact pinning exposes an incompatibility that cannot be corrected safely. Do not silently restore floating ranges without a reviewed replacement reproducibility strategy.

## Proof boundary

KMD-358 does not claim that dependency resolution is fully reproducible. The repository still lacks a committed canonical `pnpm-lock.yaml`, and transitive resolution can therefore vary. It also does not prove physical-device validation, legal/privacy approval, production restore or monitoring, production deployment, or App Store / Google Play publication.
