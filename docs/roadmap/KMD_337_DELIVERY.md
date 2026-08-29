# KMD-337 — Harden external monitoring evidence binder ingestion

## Problem

The launch-readiness binder for `external_monitoring_alerting` still read its retained smoke artifact through path-based `readFile()`. That left this evidence path outside the descriptor-bound retained-evidence reader already used by other market-release binders.

## Delivery

- Route `--artifact` through `readRetainedEvidenceFile()`.
- Keep the shared retained artifact ceiling (`RETAINED_EVIDENCE_FILE_LIMITS.artifact`, 256 MiB).
- Preserve the exact monitoring/alerting schema, HTTPS production-origin requirement, freshness policy, digest semantics, VERIFIED evidence id, validity semantics, and exclusive output creation.
- Add real CLI coverage for a regular retained artifact.
- Add fail-closed CLI coverage for a symlinked artifact and assert that no output is created.

## Validation

The repository root `pnpm test` already includes `scripts/external-monitoring-alerting-smoke-evidence-binding.test.mjs`, so the new CLI regressions are exercised by the normal CI test gate. Merge only after CI succeeds on the exact PR head and review gates are clear.

## Migration

No Prisma migration, user-data migration, API contract migration, manifest-schema migration, or operator-layout migration is required.

## Rollback

Revert the KMD-337 commits. No persistent data rollback is required.

## Proof boundary

KMD-337 hardens how a retained monitoring/alerting smoke artifact is ingested. It does not prove that a production monitor exists, that alert delivery works in the real provider, that on-call response is staffed, or that production/store/legal/device validations have been completed.
