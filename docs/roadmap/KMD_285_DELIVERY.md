# KMD-285 — Restore drill market-evidence binding

## Goal

Prevent a syntactically hashable but semantically invalid PostgreSQL restore-drill artifact from being promoted to the market-release `backup_restore_drill` evidence slot.

## Delivered behavior

`pnpm db:restore:drill:evidence:bind` reads the exact retained KMD-284 artifact bytes and validates the restore-drill contract before creating a `VERIFIED` market-evidence item.

The binder requires:

- restore-drill evidence schema v2;
- `kind=knowme-postgres-restore-drill`;
- `status=PASSED`;
- canonical non-future observation timestamp;
- an explicitly isolated restore target;
- all bounded PostgreSQL checks passing;
- canonical recovery timestamps with `observedAt == recovery.completedAt`;
- non-negative measured recovery-point age and restore duration;
- bounded recorded RPO/RTO policies;
- measured RPO and RTO remaining within the policy recorded by the artifact.

Only after those semantic checks pass does the command reuse the canonical market-evidence item builder to hash the exact artifact bytes and create the `backup_restore_drill` item. `verifiedAt` is derived from the artifact itself rather than supplied independently by the operator.

The resulting item remains only one input to the unsigned release manifest. It still must be applied, signed, bundled and pass `check:market-ready` with all other required external proofs.

## Tests

The root `pnpm test` suite now includes `scripts/postgres-restore-drill-evidence-binding.test.mjs`, covering:

- canonical passing artifact;
- exact-byte SHA-256 evidence binding;
- failed status;
- non-isolated restore target;
- failed PostgreSQL integrity check;
- RTO overrun;
- observation/completion mismatch;
- invalid JSON and future observation.

## Migration

No Prisma or user-data migration is required.

Operationally, release operators should use the specialized restore-drill binder for `backup_restore_drill` instead of the generic evidence-item creator so semantic validation cannot be skipped accidentally.

## Rollback

Revert KMD-285. The generic KMD-269 evidence-item creator remains available, but restore-drill semantic validation would again be a manual review responsibility.

## Proof boundary

KMD-285 validates the structure and internally recorded outcome of a retained restore-drill artifact. It does not prove that the drill was run against production infrastructure, that the target was operationally isolated outside the software checks, that the chosen RPO/RTO is legally or commercially adequate, or that future recoveries will meet the same objectives.

A real market proof still requires executing KMD-284 against an actual retained signed backup and genuinely isolated PostgreSQL target, retaining the exact artifact, reviewing it, binding it with this command and preserving it in the signed market-release evidence bundle.
