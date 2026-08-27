# KMD-293 — Moderation, support, and incident operations evidence binding

## Goal

Prevent an arbitrary retained file from becoming `moderation_support_incident_ops=VERIFIED` merely because it has a SHA-256 digest.

## Delivered

- Adds `pnpm release:moderation-ops:evidence:bind`.
- Parses the exact retained production drill artifact bytes.
- Accepts only schema v1, `kind=knowme-moderation-support-incident-ops-drill`, `status=PASSED`, and `environment=PRODUCTION`.
- Requires all six operational checks to be `PASSED`: report intake, report resolution, user suspension, audit trail, support escalation, and incident runbook exercise.
- Requires canonical SHA-256 digests for the retained runbook and incident record.
- Rejects unknown fields, malformed/future timestamps, and any widened proof-boundary wording.
- Derives `verifiedAt` from the retained artifact observation.
- Hashes the exact retained artifact bytes through the canonical market-evidence builder.
- Produces only the `moderation_support_incident_ops` evidence item and remains subject to manifest signing, retained-bundle verification, expiry, and `check:market-ready`.

## Proof boundary

This binder verifies schema, semantics, and byte integrity only. CI fixtures are synthetic and must never be represented as production evidence. A real release still requires a genuine production operational drill and retained runbook/incident artifacts reviewed by responsible operators. It does not prove staffing levels, legal compliance, or future incident response performance.

## Migration

No Prisma migration and no user-data change.

## Rollback

Revert KMD-293. The generic market-evidence item builder remains available, but release governance should not mark `moderation_support_incident_ops` as verified without an equivalent semantic review.

## Validation required before merge

- root tests including the KMD-293 binder suite;
- repository build;
- Prisma generate/migrate/drift checks;
- Chromium Web E2E;
- PostgreSQL API E2E;
- no claim that CI fixtures are production evidence.
