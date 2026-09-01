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
- Live GitHub has progressed through merged `KMD-364`.
- KMD-363 merged via PR #467 as `09f29aec8e224d469ee6f58dff69653af03a783d`; post-merge continuity PR #468 merged as `5afed801153451ba0de7635bca94a5b64956cdea`.
- KMD-364 exact head `c7afb153f8fc8c33520e3dfaf03c059c8f4dbc07` passed canonical CI #1400 and Runtime readiness #11 before merge. The production API remained live while PostgreSQL was stopped, returned readiness `503`, then recovered readiness `200` after PostgreSQL returned without changing API container identity.
- Runtime readiness #7 had previously exposed a real process-exit defect: the default 15-second call-maintenance scheduler detached a rejecting Prisma-backed promise. KMD-364 added scheduler-owned rejection containment plus a focused regression without weakening fail-closed readiness.
- Draft PR #469 was closed unmerged only because the integration's draft-to-ready GraphQL transition failed. Replacement PR #470 preserved the exact validated head, was non-draft and mergeable, had no reviews or unresolved threads, and merged KMD-364 as squash commit `1f353f93efdb7f2f00d91ca5801ce488af8a48a1`.
- `KMD-365` is the first unfinished core delivery. A post-KMD-364 source audit found the same detached-async scheduler risk in game maintenance, social matchmaking maintenance, creator-metrics retention and both Profile Circle notification schedulers. KMD-365 hardens those scheduler boundaries and extends the production-image PostgreSQL outage proof to a sustained 75-second outage so common periodic jobs execute while the dependency is unavailable.
- KMD-365 is active on `feat/kmd-365-scheduler-outage-resilience` and remains unmerged until canonical CI, focused scheduler tests, structural preflight and dedicated Runtime readiness all succeed on the exact head with review/thread gates clear.
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
