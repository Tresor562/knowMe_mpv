# KMD-295 — Moderation/support incident-ops drill artifact builder

## Goal

Produce the retained schema-v1 artifact consumed by KMD-293 from exact runbook and incident-record bytes, without allowing a release operator to hand-enter their SHA-256 digests.

## Delivered

- `pnpm release:moderation-ops:drill`.
- Strict schema-v1 incident record validation for six required production checks:
  - report intake;
  - report resolution;
  - user suspension;
  - audit trail;
  - support escalation;
  - incident runbook exercise.
- Every check must be `PASSED` and carry a canonical completion timestamp no later than the retained observation.
- Exact SHA-256 binding of the retained runbook bytes and retained incident-record bytes.
- Regular-file and non-symlink input requirement, with a bounded 2 MiB input size per retained source file.
- Explicit confirmation `MODERATION_OPS_DRILL_COMPLETED` before artifact creation.
- Exclusive artifact creation (`wx`), restrictive permissions where supported, `fsync`, cleanup only for files created by the current invocation, and no overwrite of an existing artifact.
- Root regression coverage.

## Usage

```bash
pnpm release:moderation-ops:drill \
  --runbook ./evidence/incident-runbook.md \
  --incident-record ./evidence/moderation-ops-record.json \
  --output ./evidence/moderation-ops-drill.json \
  --confirm MODERATION_OPS_DRILL_COMPLETED
```

The retained incident record must use the exact contract:

```json
{
  "schemaVersion": 1,
  "kind": "knowme-moderation-support-incident-ops-record",
  "environment": "PRODUCTION",
  "status": "PASSED",
  "observedAt": "2026-08-27T21:59:00.000Z",
  "checks": {
    "reportIntake": { "status": "PASSED", "completedAt": "2026-08-27T21:55:00.000Z" },
    "reportResolution": { "status": "PASSED", "completedAt": "2026-08-27T21:55:00.000Z" },
    "userSuspension": { "status": "PASSED", "completedAt": "2026-08-27T21:55:00.000Z" },
    "auditTrail": { "status": "PASSED", "completedAt": "2026-08-27T21:55:00.000Z" },
    "supportEscalation": { "status": "PASSED", "completedAt": "2026-08-27T21:55:00.000Z" },
    "incidentRunbookExercise": { "status": "PASSED", "completedAt": "2026-08-27T21:55:00.000Z" }
  }
}
```

After retaining the generated artifact, KMD-293 remains the semantic market-evidence binder:

```bash
pnpm release:moderation-ops:evidence:bind ...
```

## Migration

No Prisma or user-data migration is required. Operators who want to satisfy the market-evidence slot should retain the real runbook and the real incident/drill record, generate the KMD-295 artifact, then bind that artifact through KMD-293.

## Rollback

Revert KMD-295. KMD-293 remains available and can still validate an independently produced artifact matching its strict contract.

## Proof boundary

KMD-295 proves only that the generated artifact is bound to the exact retained runbook and incident-record bytes and that the structured record states all six checks passed at coherent times. It does **not** prove that a human actually executed the drill, that staffing/on-call coverage is sufficient, that moderation decisions were legally correct, or that future incidents will be handled successfully.

A market release still requires the real retained operational records and accountable human verification. Synthetic CI fixtures must never be used as production evidence.
