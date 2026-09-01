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
- Live GitHub has progressed through merged `KMD-362`.
- Latest verified merge at reconciliation: `KMD-362`, commit `80b6c8ec9fe8a999dadda3ced52c0237bb891eec`.
- KMD-359 committed the canonical PNPM lockfile and frozen canonical CI installation.
- KMD-360 extended frozen dependency installation to API/Web runtime Docker builds and proved both image builds before merge.
- KMD-361 removed UID 0 from final API/Web runtime commands and proved effective non-root runtime identity in production mode.
- KMD-362 added bounded liveness metadata/routes and exact-head build/E2E proof before merge.
- `KMD-363` remains the first unfinished core delivery on `feat/kmd-363-runtime-container-boot-probes`, PR #466. It is not merged.
- The KMD-363 branch has already corrected deterministic API release packaging, native `argon2`/Prisma runtime verification, bounded application-graph diagnostics and explicit production media configuration without weakening production guards.
- CI #1375 passed supply-chain policy, frozen installation, production audit, Prisma generation/migrations/zero drift, monorepo build/tests, API image build, deterministic compiled-entrypoint proof, native runtime smokes, the application-graph probe, non-root runtime identity and healthcheck metadata.
- CI #1375 then failed only at the real API runtime boot. The bounded phase marker was `nest-application-create`; logs showed many modules initialized but no `SecurityModule`, `AuthModule` or `AccountModule`.
- `SecurityCryptoService` intentionally requires a valid 32-byte `ACCOUNT_SECURITY_ENCRYPTION_KEY` in `NODE_ENV=production`. The CI runtime proof had not provided one. Production intentionally does not use its development JWT-derived fallback.
- The active branch now supplies a fixed CI-only 32-byte account-security key to both the production application-graph probe and real API boot, includes a dedicated preflight proving both bindings while preserving the production fail-closed guard, and allowlists only the configuration key name for bounded startup classification. No key value is logged.
- KMD-363 remains incomplete until one exact current head passes the complete chain: supply-chain/frozen install/audit, Prisma migrations/drift, build/tests, API image/entrypoint/native/graph proof, real API boot/liveness, real Web boot/liveness, Web E2E and API E2E, with no blocking review or unresolved review thread.
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
- real production deployment/orchestrator evidence;
- real object-storage durability/connectivity evidence;
- App Store / Google Play submission, review or publication evidence.

Live GitHub previously reported `main` as unprotected. Repository code that checks governance does not itself configure branch protection.

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
