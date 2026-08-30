# KnowMe — Current delivery checkpoint

Last reconciled from live GitHub: 2026-08-30.

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
- Live GitHub has progressed through merged `KMD-348`.
- Latest verified merge at reconciliation: `KMD-348`, commit `da47d52a710830be09796f6543303dceca1c6a11`.
- `KMD-349` is the current exact-head quality-provider provenance candidate on `feat/kmd-349-bind-live-quality-check-provider`; it is not complete until exact-head CI and merge gates pass.
- The old `docs/roadmap/DELIVERY_LEDGER.md` section that described `KMD-061` as pending is stale and must not be used to recreate KMD-061 or later merged milestones.

## Independent historical validation boundary

`KMD-059` remains independent because real supported-device validation has not been proven. Historical draft PRs #108 and #217 must not be treated as proof that physical Web/iOS/Android validation is complete.

Do not merge, recycle or renumber that hardware-validation scope merely to make the KMD sequence look contiguous.

## Release blockers still external or unproven

At reconciliation time, none of the following may be claimed complete without direct evidence:

- canonical `main` branch protection satisfying the release-governance guard, including a provider-pinned canonical `quality` required check whose live exact-head execution comes from that same provider;
- real legal/privacy review and continuing legal validity;
- supported-device physical validation on Web/iOS/Android where required;
- production backup/restore execution evidence;
- production monitoring/alert delivery evidence;
- real production deployment evidence;
- App Store / Google Play submission, review or publication evidence.

Live GitHub still needs to satisfy the actual governance configuration; code that checks governance does not itself configure branch protection.

## Restart protocol

Before starting another KMD:

1. read `/AGENTS.md` and `/docs/NEXUS_INTEGRATION_CHECKPOINT.md`;
2. read this checkpoint;
3. inspect live `main`, open PRs, active branches and CI;
4. inspect canonical `KMD_###_DELIVERY.md` files and run the KMD registry integrity preflight when available;
5. choose the first truly unfinished delivery instead of relying on numeric assumptions;
6. create a dedicated branch from current stable `main`;
7. add tests, migrations when needed, documentation and rollback information;
8. merge only after exact-head validation and review/thread gates are satisfied;
9. update this checkpoint deliberately when the live delivery boundary changes materially.

## Permanent rule

A delivery document, branch name, draft PR, remembered milestone or historical ledger entry does not by itself prove completion. Only the canonical GitHub merge state plus the required validation evidence can establish that a KMD is finished.
