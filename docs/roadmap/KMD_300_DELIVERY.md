# KMD-300 — Market release evidence action plan

## Goal

Turn the deterministic readiness report into an explicit, fail-closed operator plan without fabricating any evidence or weakening the market gate.

## Delivery

KMD-300 adds `pnpm release:evidence:plan -- --file <manifest.json>`.

The planner reuses the canonical KMD-298 readiness assessment and lists only blocking evidence. For every common WEB_V1 requirement it points to the dedicated semantic binder already enforced by the repository. For FULL-only iOS/Android physical validation and store submission, it intentionally exposes no executable command and marks the work as `MANUAL_EXTERNAL_EVIDENCE`.

The output includes the current state, responsible operational role, binder command when one exists, the first next action, and an explicit proof boundary.

## Safety properties

- no evidence is created, mutated, signed, applied, or marked `VERIFIED`;
- expired or invalid required evidence remains blocking and becomes actionable again;
- WEB_V1 blockers never fall back to the generic evidence creator;
- physical-device and store evidence never receive a fake automation path;
- unknown required evidence fails closed because the planner has no silent default mapping.

## Migration

No Prisma or user-data migration is required. Release operators may use the planner after `release:evidence:init` or `release:evidence:status` to identify the next legitimate evidence-producing workflow.

## Rollback

Revert KMD-300 and continue using the KMD-298 readiness report plus the existing runbooks and binder commands manually. No persisted application state or retained evidence bundle is modified.

## Proof boundary

A successful plan proves only that the repository can map currently blocking evidence IDs to the intended operational workflow. It does not prove deployment, TLS/DNS, backup recovery, monitoring/on-call, legal/privacy approval, data export/deletion, moderation readiness, antimalware operation, physical-device behavior, or store acceptance.
