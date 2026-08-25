# KMD-239 — Media quarantine retention release policy

## Goal

Prevent a market release from silently retaining quarantined upload bytes indefinitely. KMD-239 requires explicit, bounded retention decisions for malware-positive and scanner-unavailable media before release.

## Changes

- Adds `MEDIA_QUARANTINE_INFECTED_RETENTION_DAYS`.
- Adds `MEDIA_QUARANTINE_UNAVAILABLE_RETENTION_DAYS`.
- Both values are mandatory for `pnpm check:release` and must be canonical integers in the range 1..3650 days.
- Adds dedicated release-preflight regression tests and wires them into the root `pnpm test` gate.
- Documents the variables in `.env.example` without inventing universal default durations.

## Privacy and legal boundary

There is no universal retention duration that is automatically correct for every deployment or jurisdiction. KMD-239 deliberately requires an explicit operational/legal decision rather than hard-coding a pretend compliance answer.

The infected and unavailable windows are separate because they can have different operational and legal purposes. A malware-positive object may be needed temporarily for abuse/security investigation, while a scanner-unavailable object is an availability failure and should not automatically inherit the same retention period.

## Product boundary

KMD-239 does not delete any object and does not claim that retention is enforced yet. It only makes the release configuration decision explicit and machine-validated. A subsequent milestone must implement bounded, auditable cleanup of expired quarantine objects without deleting media that has become `AVAILABLE`, and must define failure/retry behavior for object-storage deletion.

The KMD-228 market blocker remains active. A real production scanner provider and its target-environment validation are still required.

## Tests

Coverage verifies:

- both retention variables are required;
- canonical integer parsing;
- rejection of zero, negative, fractional, leading-zero, non-numeric and >3650 values;
- acceptance of the exact lower and upper boundaries.

## Migration

No Prisma migration is required. Operators must choose and approve the two retention windows before a market-release preflight can pass.

## Rollback

Revert KMD-239. This removes the new release-preflight requirements only; it does not alter existing media rows or storage objects.

## External proof still required

KMD-239 does not prove or claim:

- legal approval of any chosen duration;
- physical object deletion in production storage;
- storage-provider lifecycle configuration;
- malware-provider validation;
- analyst incident-retention procedures;
- production deployment.

## Merge gate

Merge only after the exact PR head passes dependency audit, Prisma generation, migration deploy, zero drift, full monorepo build, root tests, Chromium Web E2E and PostgreSQL API E2E.
