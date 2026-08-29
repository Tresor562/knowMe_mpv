# KMD-336 — Harden moderation/support incident evidence binder ingestion

## Problem

The launch-critical `moderation_support_incident_ops` evidence binder still read its retained artifact through a path-based `readFile()` call before JSON parsing. That bypassed the shared retained-evidence safe-read protections already adopted by adjacent release evidence binders.

Because this artifact can become a VERIFIED market-release evidence item, its retained bytes must be read fail-closed and descriptor-bound rather than trusting a path between lookup and ingestion.

## Delivery

- Replaced the direct `readFile()` ingestion path in `scripts/moderation-support-incident-ops-evidence-binding.mjs` with `readRetainedEvidenceFile()`.
- Reused `RETAINED_EVIDENCE_FILE_LIMITS.artifact` (256 MiB) instead of introducing a new limit.
- Preserved the existing KMD-293 semantic contract unchanged:
  - exact schema;
  - `PRODUCTION` environment;
  - all six moderation/support/incident checks must be `PASSED`;
  - canonical proof boundary;
  - SHA-256 validation;
  - evidence id `moderation_support_incident_ops`;
  - exclusive output creation.
- Added real CLI coverage for a regular retained artifact and fail-closed rejection of a symlinked artifact before JSON ingestion, including proof that no output is created on rejection.

## Validation

Expected repository validation includes the existing full test suite plus the updated `moderation-support-incident-ops-evidence-binding.test.mjs`. CI must succeed on the exact branch head before merge.

## Migration

No Prisma migration, user-data migration, API migration, release-manifest schema migration, or operator-directory migration is required.

## Rollback

Revert the KMD-336 commits. No data rollback is required.

## Proof boundary

KMD-336 hardens only the ingestion of retained moderation/support/incident-operations evidence. It does not prove that production staffing is adequate, that a real incident was handled correctly, that legal/privacy obligations are satisfied, that physical-device validation has occurred, or that production/store deployment has completed.
