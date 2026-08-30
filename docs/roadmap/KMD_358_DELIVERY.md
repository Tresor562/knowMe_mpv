# KMD-358 — Exact direct JavaScript dependency pins

## Goal

Reduce JavaScript supply-chain drift while the canonical `pnpm-lock.yaml` gap remains unresolved by requiring every direct registry dependency in the KnowMe monorepo to use an exact package version.

This is a compensating reproducibility control, not a replacement for a real lockfile. Transitive dependency resolution is still not fully frozen until a canonical lockfile is generated from PNPM 10.13.1 and committed after full validation.

## Scope

The root, API, Web, Mobile and shared contract package manifests now use exact versions for direct registry dependencies and development dependencies. Internal monorepo links continue to use `workspace:*`.

The CI pre-install supply-chain gate runs `scripts/package-dependency-pinning-preflight.test.mjs` together with the existing CI workflow supply-chain test before `pnpm install`.

The guard rejects caret, tilde, wildcard, comparator and other floating direct registry ranges. It also requires the root `packageManager` declaration to remain an exact PNPM version.

The first exact-head CI attempt (#1247) proved the guard and install path, then correctly failed the unsuppressed production dependency audit. That failure exposed stale security baselines rather than a test defect. The branch therefore upgrades Next.js to 15.5.21, Playwright to 1.55.1 and Multer to 2.2.0, and pins the affected transitive `path-to-regexp` and `lodash` paths to reviewed fixed versions 8.4.2 and 4.18.1. No advisory is ignored or suppressed.

A later exact-head run exposed a browser-test compatibility issue after the Next.js upgrade: successful password-reset rendering could coincide with `net::ERR_ABORTED` events from browser-cancelled Next.js RSC/static prefetches during deliberate navigation. The browser-failure collector now ignores only GET requests with the exact `net::ERR_ABORTED` reason when the target is a Next.js `_rsc` request or `/_next/static/` asset. All other failed requests, browser console errors and page errors remain release-blocking; the reset controls, fragment consumption and HTTP success assertions are unchanged.

The API E2E rerun on head `1513ef1f515f096a3e86e7486cd7000c1723b71d` then exposed a test-harness regression rather than isolated product failures: all 71 API E2E suites timed out in their 5-second setup hooks, with the later teardown errors caused only because `app` was never initialized. The same log repeatedly warned that `ts-jest` was unnecessarily compiling already-built workspace `.js` files even though `allowJs` is disabled. The E2E Jest transform is therefore narrowed from `^.+\\.(t|j)s$` to `^.+\\.ts$`, leaving JavaScript artifacts to Node instead of re-transpiling them in every suite. This is a harness-performance correction; the 5-second Jest timeout has not been weakened or increased, so slow application initialization remains detectable.

## Validation required before merge

- pre-install CI supply-chain policy tests pass;
- `pnpm install --frozen-lockfile=false` succeeds using the exact direct pins;
- unsuppressed `pnpm audit --prod --audit-level=high` passes;
- Prisma generation and deployed migrations pass;
- schema drift check passes;
- full build and test suite pass;
- Web E2E passes;
- API E2E passes without raising the existing 5-second hook timeout;
- no blocking review or unresolved review thread remains;
- merge must target the exact validated head SHA.

## Migration

No Prisma schema or user-data migration is introduced.

Dependency resolution changes deliberately for direct packages whose previous minimum is no longer security-acceptable. CI is the acceptance boundary for API/build/runtime compatibility.

## Rollback

Revert the KMD-358 merge commit if exact pinning exposes an incompatibility that cannot be corrected safely. Do not roll back to versions known to fail the high/critical production audit, and do not silently restore floating ranges without a reviewed replacement reproducibility strategy.

If the narrowed E2E transform itself causes a test-runtime incompatibility, restore the prior transform in isolation and diagnose the affected JavaScript module; do not hide the problem by globally increasing Jest hook timeouts.

## Proof boundary

KMD-358 does not claim that dependency resolution is fully reproducible. The repository still lacks a committed canonical `pnpm-lock.yaml`, and transitive resolution can therefore vary. It also does not prove physical-device validation, legal/privacy approval, production restore or monitoring, production deployment, or App Store / Google Play publication.
