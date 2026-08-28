# KMD-304 — Manual evidence proof requirements

## Goal

Make the market-release action plan explicit about the minimum retained proof expected for release gates that cannot be honestly automated: privacy/legal human review, moderation/support incident drills, physical iOS/Android validation, and App Store / Google Play submission.

## Delivered

- Market evidence action-plan schema advances to v3.
- Human/manual steps now expose `proofRequirements` describing minimum evidence content.
- Privacy/legal review requirements bind the reviewer role, review timestamp/release context, exact reviewed documents, required review areas, and retained review record.
- Moderation/support drill requirements bind the exercised scenario, operational paths, response timing/outcome, gaps/remediation, and retained drill record.
- Physical-device requirements bind real hardware/OS, KnowMe version/build/commit, accountable tester role, critical-flow results, defects/disposition, and retained evidence digest.
- Store-submission requirements bind application identifier, submitted version/build, dated store reference, real submission/review status, publishing owner role, and retained redacted store evidence.
- Manual and legal gates deliberately retain `command: null`; this change does not simulate, execute, or certify those validations.
- Regression tests assert these requirements remain present and that physical/store gates remain non-executable.

## Migration

No Prisma migration and no user-data migration.

The operator-facing action-plan JSON changes additively at manual/human step level and increments `schemaVersion` from 2 to 3. Consumers that pin the action-plan schema must accept v3 before rollout.

## Rollback

Revert the KMD-304 commits. No database state, retained evidence bytes, release signatures, deployment state, store state, or user data are modified by this block.

## Proof boundary

`proofRequirements` are policy/operational guidance only. Their presence does not prove that a review, drill, physical-device test, deployment, or store submission happened. Actual release evidence must still be produced by the accountable humans/systems, retained, hashed/bound through the existing evidence workflow, and pass the authoritative market-ready gate.
