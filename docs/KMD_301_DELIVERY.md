# KMD-301 — Market evidence workflow sequencing

## Goal

Make the market evidence action plan operationally complete without fabricating proof or weakening any release gate.

KMD-300 identified the responsible binder for each blocker. KMD-301 adds the prerequisite validation or artifact-building sequence so an operator does not jump directly to a binder before the real validation that must produce the retained evidence.

## Delivery

`pnpm release:evidence:plan -- --file <manifest.json>` now emits schema version 2 actions containing ordered `steps`.

For production TLS/domain, deployment smoke, backup restore, monitoring, data lifecycle, and antimalware evidence, each action lists the real validation command first and the semantic binder second.

Privacy/legal evidence explicitly starts with a non-automatable `HUMAN_REVIEW` gate, then the retained artifact builder, then the semantic binder.

Moderation/support evidence explicitly starts with a non-automatable `REAL_DRILL` gate, then the retained drill artifact builder, then the semantic binder.

Physical iOS/Android validation and App Store/Google Play submission remain `MANUAL_EXTERNAL_EVIDENCE` and expose no executable command.

The legacy top-level `command` field remains as a convenience pointer to the first executable repository command, but the ordered `steps` array is authoritative for sequencing. It never skips an earlier manual gate.

## Safety properties

- Planning never creates, mutates, signs, applies, or verifies evidence.
- Every WEB_V1 blocker is mapped fail-closed to a known workflow.
- A binder is never presented as the first workflow phase when a prior smoke, drill, artifact build, or human review is required.
- Legal review and moderation drill remain explicitly human/operational work.
- Physical-device and store validation remain fully external and have no fake command.
- Unknown required evidence still fails closed through the existing planner mapping contract.

## Tests

The root test gate now verifies:

- all six automated WEB_V1 validation/binder sequences;
- privacy/legal human-review → artifact → binder ordering;
- moderation/support real-drill → artifact → binder ordering;
- manual-only FULL physical/store evidence has no executable path;
- verified evidence disappears from the action list;
- expired evidence becomes actionable again;
- a complete manifest has no next action.

## Migration

No Prisma migration or user-data migration is required. This changes only release-operator planning output from schema version 1 to schema version 2.

Consumers of the JSON planner output must read the ordered `steps` array for workflow sequencing. The top-level `command` remains available as the first executable repository command for compatibility.

## Rollback

Revert KMD-301. Existing release manifests, retained evidence, signatures, receipts, database state, and market gates are unchanged. Operators can fall back to the KMD-300 single-command planner plus the individual runbooks.

## Proof boundary

A generated plan proves only that the repository can map a blocking evidence ID to the intended sequence of repository workflows. It does not prove that production is deployed, DNS/TLS is correct, a restore succeeded, alerting reaches a staffed responder, legal/privacy review occurred, data deletion/export is correct in production, a moderation drill occurred, antimalware is operational, physical devices were tested, or either store accepted a submission.
