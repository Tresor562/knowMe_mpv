# KnowMe — Current delivery checkpoint

Last reconciled from live GitHub: 2026-09-01.

## Authority order

For current delivery status, use this order:

1. live GitHub state in `Tresor562/knowMe_mpv` (`main`, merged PRs, open PRs, branches and CI);
2. this checkpoint, when its reconciliation date still matches the work session;
3. canonical per-delivery files `docs/roadmap/KMD_###_DELIVERY.md` for scope, tests, migrations, rollback and proof boundaries;
4. `docs/roadmap/DELIVERY_LEDGER.md` only as a historical ledger for its older entries.

If any remembered conversation or historical document conflicts with live GitHub, live GitHub wins.

## Current reconciled baseline

- Canonical repository: `Tresor562/knowMe_mpv`.
- `KMD-060` is complete and must never be recreated.
- Live GitHub has progressed through merged `KMD-363`.
- Latest verified merge at reconciliation: `KMD-363`, squash commit `09f29aec8e224d469ee6f58dff69653af03a783d` via PR #467.
- Post-merge continuity PR #468 passed exact-head CI #1388 and merged as `5afed801153451ba0de7635bca94a5b64956cdea`; it changed documentation only.
- KMD-359 committed the canonical PNPM lockfile and frozen canonical CI installation.
- KMD-360 extended frozen dependency installation to API/Web runtime Docker builds and proved both image builds before merge.
- KMD-361 removed UID 0 from final API/Web runtime commands and proved effective non-root runtime identity in production mode.
- KMD-362 added bounded liveness metadata/routes and exact-head build/E2E proof before merge.
- KMD-363 added real production-image boot/liveness gates for API and Web, deterministic API release packaging, native `argon2`/Prisma runtime verification, bounded secret-safe application-graph/startup diagnostics, and explicit CI-only configuration for production guards without weakening those guards.
- Exact final KMD-363 head `f817ad9589a1c23e26c2bf85f2bacaa3050de466` passed GitHub Actions CI #1385 end to end before merge: supply-chain/configuration preflights, frozen install, production audit, Prisma generation/migrations/zero drift, monorepo build/tests, API image/entrypoint/native/graph proof, non-root identity/health metadata, real API healthy boot/direct liveness, Web image/identity/health metadata, real Web healthy boot/direct liveness, Web E2E and API E2E.
- Original draft PR #466 was closed unmerged only because the draft-to-ready API transition failed. Replacement PR #467 preserved the exact same validated head SHA, was non-draft and mergeable, had no submitted reviews or unresolved review threads, and was merged without widening scope.
- `KMD-364` is now the first unfinished core delivery on `feat/kmd-364-runtime-readiness-proof`. It was selected from a live launch-readiness gap rather than numeric continuity: KMD-363 proves process boot/liveness, while KMD-364 must prove that the exact production API image returns readiness `503` during a real PostgreSQL outage, remains live, and recovers readiness after PostgreSQL returns without restarting the API process.
- KMD-364 remains unmerged until both canonical CI and the dedicated exact-head `Runtime readiness` workflow succeed and review/thread gates are clear.
- The old `docs/roadmap/DELIVERY_LEDGER.md` section describing `KMD-061` as pending is stale and must not be used to recreate KMD-061 or any later merged milestone.

## Independent historical validation boundary

`KMD-059` remains independent because real supported-device validation has not been proven. Historical draft PRs #108 and #217 do not prove physical Web/iOS/Android validation.

Do not merge, recycle or renumber that hardware-validation scope merely to make the KMD sequence look contiguous.

## Release blockers still external or unproven

None of the following may be claimed complete without direct evidence:

- canonical `main` branch protection satisfying release governance, including the required canonical quality check;
- real legal/privacy review and continuing legal validity;
- supported-device physical validation on Web/iOS/Android where required;
- production backup/restore execution evidence;
- production monitoring/alert delivery evidence;
- real production deployment/orchestrator evidence, including actual load-balancer readiness-probe wiring;
- real object-storage durability/connectivity evidence;
- App Store / Google Play submission, review or publication evidence.

Repository code that checks governance does not itself configure branch protection. During this reconciliation, the GitHub integration could not read the branch-protection endpoint because that resource was not accessible to the integration; the repository rulesets collection was empty, so no new branch-protection claim is made.

## Restart protocol

Before starting another KMD:

1. read `/AGENTS.md` and `/docs/NEXUS_INTEGRATION_CHECKPOINT.md`;
2. read this checkpoint;
3. inspect live `main`, open PRs, active branches and CI;
4. inspect canonical `KMD_###_DELIVERY.md` and registry integrity when available;
5. choose the first truly unfinished delivery instead of relying on numeric assumptions;
6. create a dedicated branch from current stable `main`;
7. add tests, migrations when needed, documentation and rollback information;
8. merge only after exact-head validation and review/thread gates are satisfied;
9. update this checkpoint deliberately when the live delivery boundary changes materially.

## Permanent rule

A delivery document, branch name, draft PR, remembered milestone or historical ledger entry does not by itself prove completion. Only canonical GitHub merge state plus required validation evidence can establish that a KMD is finished.
