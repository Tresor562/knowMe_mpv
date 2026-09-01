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
- Live GitHub has progressed through merged `KMD-365`.
- KMD-363 merged via PR #467 as `09f29aec8e224d469ee6f58dff69653af03a783d`; post-merge continuity PR #468 merged as `5afed801153451ba0de7635bca94a5b64956cdea`.
- KMD-364 exact head `c7afb153f8fc8c33520e3dfaf03c059c8f4dbc07` passed canonical CI #1400 and Runtime readiness #11 before merge. The production API remained live while PostgreSQL was stopped, returned readiness `503`, then recovered readiness `200` after PostgreSQL returned without changing API container identity. Draft PR #469 was superseded only because the integration's draft-to-ready GraphQL transition failed; replacement PR #470 preserved the exact validated head and merged KMD-364 as squash commit `1f353f93efdb7f2f00d91ca5801ce488af8a48a1`.
- KMD-365 generalized outage containment to game-session maintenance, social matchmaking maintenance, creator-metrics retention, and both Profile Circle notification schedulers. It also extended the exact production-image readiness proof to a sustained 75-second PostgreSQL outage sampled every five seconds.
- Initial KMD-365 head `43357de5b57d1ecc817ab924e7fffb2e8b7c3315` passed Runtime readiness #15 but CI #1404 exposed a real scheduler lifecycle defect: both Profile Circle schedulers set `running=true` before database-backed lease acquisition, so an acquisition rejection could leave the scheduler permanently reporting a local run active and prevent later retries.
- Final KMD-365 head `3e3064f4939f323bbb9227d2717f497a6c9742e2` moved lease acquisition inside the lifecycle boundary, made lease release conditional, and guarantees the local `running` guard resets even if acquisition or release fails. It passed canonical CI #1406 end to end and Runtime readiness #17 end to end, including build, unit tests, API/Web production-image boots, Web E2E, API E2E, sustained dependency loss and readiness recovery without API restart.
- Draft PR #471 was closed unmerged only because the integration's draft-to-ready GraphQL mutation failed on the unsupported `Repository.fullDatabaseId` field. Replacement PR #472 preserved the exact same validated head SHA, was non-draft and mergeable, had no submitted reviews or unresolved review threads, and merged KMD-365 as squash commit `abaa80ce27d2fb852bacb48f42072afa21edf9c7` without widening scope.
- No `KMD-366` is selected merely for numeric continuity. The next core delivery must be chosen from a fresh live launch-readiness audit. Existing backup/restore and market-release evidence tooling must be inspected before creating new work so already merged capabilities are not duplicated.
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

Repository code that checks governance does not itself configure branch protection. The GitHub integration has not established branch-protection compliance, so no such release claim is made.

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
