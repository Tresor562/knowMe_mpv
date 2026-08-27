# KMD-284 — Restore drill RPO/RTO policy and measured evidence

## Goal

Strengthen the isolated PostgreSQL restore drill introduced by KMD-283 so a successful drill also proves that the selected retained backup and the measured restore execution met explicit recovery-point and recovery-time objectives for that run.

KMD-284 does **not** invent universal RPO/RTO values. Operators must choose the thresholds appropriate to the actual KnowMe release and retain the resulting evidence for review.

## Delivered behavior

`pnpm db:restore:drill` now requires both recovery policies:

```bash
pnpm db:restore:drill -- \
  --file /secure/knowme.dump \
  --output /secure/knowme-restore-drill.json \
  --max-age-hours 24 \
  --max-rto-seconds 900 \
  --confirm RESTORE_DRILL_KNOWME
```

`--max-age-hours` remains the signed-backup freshness guard and is now also recorded explicitly as the maximum RPO policy for the drill. `--max-rto-seconds` is a new mandatory canonical positive integer between 1 and 86400 seconds.

The drill uses a monotonic timer around the restore + PostgreSQL integrity-check phase. After the integrity checks pass it computes:

- `recoveryPointAgeSeconds`: age of the selected signed backup at drill start;
- `restoreDurationMs`: measured elapsed restore/check duration;
- `policy.maxRpoHours`;
- `policy.maxRtoSeconds`;
- exact `startedAt` and `completedAt` timestamps.

The evidence schema is upgraded from v1 to v2. An evidence artifact is written only when:

1. the signed backup is authentic and within the configured RPO/freshness window;
2. the restore target is isolated from `DATABASE_URL`;
3. the guarded restore succeeds;
4. the bounded PostgreSQL schema checks succeed;
5. measured restore duration is within the configured RTO threshold.

If the RTO check fails, the reserved evidence file is deleted and the command fails. A failed recovery objective can therefore never produce a `PASSED` artifact.

## Tests

The existing root `pnpm test` suite continues to execute `scripts/postgres-restore-drill.test.mjs`. KMD-284 extends it to cover:

- canonical RTO policy bounds;
- exact-boundary RPO/RTO acceptance;
- RPO overrun rejection;
- RTO overrun rejection;
- deterministic monotonic duration measurement;
- schema-v2 recovery metrics in the retained artifact;
- cleanup of the reserved evidence file when measured RTO misses policy;
- preservation of KMD-283 isolation, credential secrecy, output exclusivity, and failure cleanup protections.

The full repository CI remains authoritative for build, unit tests, migrations/drift, Chromium Web E2E, and PostgreSQL API E2E.

## Migration

No Prisma or user-data migration is required.

Operational adoption requires choosing and recording an explicit RTO threshold for each real drill and updating existing KMD-283 drill commands to pass `--max-rto-seconds`.

Existing KMD-283 evidence artifacts remain historical artifacts; they do not retroactively prove measured RTO and should not be represented as KMD-284 recovery-objective evidence.

## Rollback

Revert KMD-284. The KMD-283 isolated restore drill remains available without measured RTO enforcement or schema-v2 recovery metrics.

## Proof boundary

CI tests use simulated child-process outcomes and deterministic clocks. They prove the software contract only.

A real `backup_restore_drill` market proof still requires executing the command against an actual retained signed backup and a genuinely isolated PostgreSQL target, preserving the exact resulting artifact, hashing/reviewing it, and binding it into the signed market-release evidence bundle.

A passing KMD-284 artifact proves only that this particular drill met the configured RPO/RTO thresholds and bounded schema checks. It does not prove future recovery performance, production failover, remote backup durability, correctness of every business row, replication, or legal adequacy of the chosen recovery objectives.
