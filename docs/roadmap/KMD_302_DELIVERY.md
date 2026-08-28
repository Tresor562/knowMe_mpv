# KMD-302 — Market evidence plan command contract

## Goal

Prevent the release action planner from drifting into dead or renamed commands while keeping all real-world proof boundaries intact.

KMD-301 made every market evidence workflow explicit and ordered. KMD-302 adds a repository contract check proving that every executable workflow step resolves to an actual root `package.json` script.

## Delivery

`pnpm release:evidence:plan:contract` validates the complete `FULL` action plan generated from the canonical manifest initializer and readiness engine.

For every non-manual workflow step, the check requires the command to be a single canonical root-script invocation of the form `pnpm <script>` and verifies that `<script>` exists in the current root `package.json`.

Manual legal review, real moderation drills, physical-device validation, and store submission steps remain command-less where required. The contract check never turns them into automated work.

## Safety properties

- The checker derives required FULL evidence from the canonical manifest initializer rather than maintaining a second evidence list.
- It derives workflow steps from the canonical KMD-301 action planner rather than maintaining a second command map.
- Missing root scripts fail closed.
- Unsupported command forms fail closed instead of invoking arbitrary shell content.
- The checker does not execute workflow commands, mutate manifests, create evidence, sign evidence, or contact production systems.
- Real-world validation remains mandatory wherever the underlying workflow requires it.

## Tests

The root test gate verifies that:

- every executable action-plan step currently resolves to a real root package script;
- deleting a referenced script causes a deterministic failure;
- a malformed package definition without a `scripts` object fails closed.

## Migration

No Prisma migration or user-data migration is required. This is release tooling and CI-contract hardening only.

## Rollback

Revert KMD-302. Existing release manifests, retained evidence, signatures, receipts, database state, and market readiness gates are unchanged.

## Proof boundary

A passing command contract proves only that the repository action plan points to commands that exist in the checked revision. It does not prove that any production smoke, restore drill, monitoring alert, legal/privacy review, moderation drill, antimalware validation, physical-device test, or store submission has actually occurred or succeeded.
