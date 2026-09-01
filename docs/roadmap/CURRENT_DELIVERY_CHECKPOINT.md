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
- Live GitHub has progressed through merged `KMD-372`.
- KMD-363 merged via PR #467 as `09f29aec8e224d469ee6f58dff69653af03a783d`; post-merge continuity PR #468 merged as `5afed801153451ba0de7635bca94a5b64956cdea`.
- KMD-364 exact head `c7afb153f8fc8c33520e3dfaf03c059c8f4dbc07` passed canonical CI #1400 and Runtime readiness #11 before merge. The production API remained live while PostgreSQL was stopped, returned readiness `503`, then recovered readiness `200` after PostgreSQL returned without changing API container identity. Replacement PR #470 preserved the validated head and merged KMD-364 as squash commit `1f353f93efdb7f2f00d91ca5801ce488af8a48a1`.
- KMD-365 generalized outage containment to database-backed background schedulers and extended sustained dependency-loss proof. Final exact head `3e3064f4939f323bbb9227d2717f497a6c9742e2` passed canonical CI #1406 and Runtime readiness #17, then merged through PR #472 as squash commit `abaa80ce27d2fb852bacb48f42072afa21edf9c7`.
- KMD-366 exact head `9118e59de2de6e71d5019ec64ba731e6bcd49bdf` proves that a bearer token issued before account deletion loses authorization immediately after `DELETE /account`, while password login is also rejected and secrets are not retained in the result. The exact head passed canonical CI #1412 and Runtime readiness #22, had no submitted reviews or unresolved review threads, and merged through non-draft PR #475 as squash commit `03a52f37a2bf29ece71023137ff5002a375003e6`.
- KMD-367 upgraded `data_export_delete_validation` so new release evidence must include the pre-deletion bearer revocation guarantee. It merged through PR #477 as squash commit `ebb0912ff24f24ef2120e3441faa3723320c5b71` after exact-head CI passed.
- KMD-368 hardened the PostgreSQL restore-drill evidence to schema v3, requiring at least one successfully applied Prisma migration and zero unfinished migrations, and aligned the market-evidence binder to the generated artifact. Exact head `6b97e7d224a46f60a11d9be5940061b33aca490b` passed CI #1417 with no submitted reviews or unresolved threads. Because the connector draft→ready mutation remained broken, draft PR #478 was closed without merge and non-draft replacement PR #479 preserved the validated head, then merged as squash commit `864ef36f4dc27888fbc113c19161d143718f3ff7`.
- KMD-369 exact head `36c0e89d94367ed6879a43378f96bde1136713a5` passed CI #1420 and Runtime readiness #26 with no submitted reviews or unresolved review threads. The connector draft→ready mutation again failed, so draft PR #480 was closed without merge and non-draft replacement PR #481 preserved the exact validated head. PR #481 merged KMD-369 as squash commit `83ec959cf5a132b8e81910b8f8916fa7edd5069e`.
- KMD-370 exact head `6c64bfd222ad9f2e5eeb67b6de2f874106d14c01` passed canonical CI #1423 with no submitted reviews or review threads. The connector draft→ready mutation failed on `Repository.fullDatabaseId`; draft PR #482 was closed without merge and non-draft replacement PR #483 preserved the exact validated head/base. PR #483 merged KMD-370 as squash commit `50f0bed557fc93e67a3ae06fbec829ab54f12052`.
- KMD-371 final head `11a2cad2d2e4fc4369293f4807ea14adda1d2823` corrected stale market action-plan counts after adding `object_storage_provider_validation`, then passed canonical CI #1430 and Runtime readiness #34 with no submitted reviews or unresolved review threads. PR #485 merged KMD-371 as squash commit `7499936627f15c1c6d57a417a43aabcf34afd06d`. The required WEB_V1/FULL market-evidence registry now includes the retained KMD-369/KMD-370 object-storage provider proof through the dedicated KMD-371 binder and operator action mapping.
- KMD-372 exact head `3017a77a8ee981e76265caa127f9ea8a2eb40af0` passed canonical CI #1433 and Runtime readiness #37, had no blocking review/thread gate, and merged through PR #486 as squash commit `900bec99e9f5277608f3cf81881906493eeb720e`. Account-media deletion now fails closed when private provider deletion fails, so durable media metadata is not discarded before object deletion is confirmed.
- KMD-373 is the current active delivery on `feat/kmd-373-account-media-lifecycle-lock` / PR #487. It closes the remaining race between destructive account cleanup and an upload already in flight by serializing upload completion and deletion-fence installation on the owning PostgreSQL `User` row. It must not merge until exact-head CI/runtime-readiness and review/thread gates are clear, and it does not claim a real production-provider purge.
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
- real object-storage durability/connectivity evidence, including execution of KMD-369 against the production bucket and KMD-371 binding of the retained artifact;
- real production account-deletion execution proving provider objects and provider-retained versions are removed according to the applicable policy;
- App Store / Google Play submission, review or publication evidence.

Repository code that checks governance does not itself configure branch protection. No branch-protection compliance claim is made without direct GitHub configuration evidence.

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
