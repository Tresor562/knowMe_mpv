# KMD-305 — Manual release evidence template

## Goal

Provide a deterministic, release-bound worksheet for the four FULL-release validations that cannot be honestly automated: physical iOS QA, physical Android QA, App Store submission, and Google Play submission.

## Delivery

- Adds `pnpm release:evidence:manual:template -- --commit <sha> --version <semver> --output <file.json>`.
- Reuses the canonical FULL release manifest validation for commit/version canonicality.
- Reuses KMD-304 action-plan proof requirements rather than duplicating a second source of truth.
- Produces only `PENDING_MANUAL_VALIDATION` entries.
- Records blank validation metadata, retained-proof URI/digest slots, and one tri-state attestation per canonical requirement.
- Marks the document `templateOnly: true` and `certifiesValidation: false`.
- Does not emit signing metadata or the schema of a verified market evidence item.
- Uses exclusive file creation (`wx`) and restrictive permissions where supported so an existing worksheet is not silently overwritten.

## Validation

The root test gate includes the KMD-305 unit suite covering:

- the exact four manual FULL evidence IDs;
- release commit/version binding;
- canonical device/store requirement inheritance from the action plan;
- fail-closed behavior for invalid release metadata;
- the inability of a fresh template to masquerade as verified/signed market evidence.

The branch must still pass the repository CI gate before merge.

## Migration

No Prisma migration and no user-data migration are required. This block adds release-operations tooling only.

## Rollback

Revert the KMD-305 commits. Existing market evidence manifests, retained evidence, signatures, production state, devices, and store submissions are unchanged.

## Proof boundary

Generating or completing the worksheet is not proof that any physical-device QA or store submission occurred. Those actions must happen in the real external systems, retained evidence must be reviewed, and the release evidence workflow must remain pending until acceptable external proof is bound through the appropriate controlled process. KMD-305 never performs, signs, verifies, or certifies those validations.
