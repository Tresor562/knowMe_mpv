# KMD-254 — Market release evidence target binding

## Goal

Prevent market-readiness evidence from being reused for the wrong deployment target or release candidate even when the evidence references and SHA-256 digests themselves are valid.

## Changes

- bumps the market evidence manifest contract to `schemaVersion: 2`;
- requires `environment: "PRODUCTION"`;
- requires a canonical SemVer `releaseVersion` without build metadata;
- requires the release operator/CI to supply the exact expected release version through `--version <semver>` or `KNOWME_RELEASE_VERSION`;
- rejects a manifest whose `releaseVersion` differs from the release candidate being checked;
- preserves the exact commit binding introduced by KMD-251 and the evidence validity/integrity requirements introduced by KMD-252/KMD-253.

Release candidates such as `1.0.0-rc.1` are accepted. Non-canonical versions such as `01.0.0`, `v1.0.0`, whitespace-padded values and versions with build metadata are rejected so that one textual identifier maps to one release target.

## Migration

Existing evidence manifests using schema version 1 must be migrated before `check:market-ready` can pass:

1. change `schemaVersion` to `2`;
2. add `environment: "PRODUCTION"`;
3. add the exact `releaseVersion` being evaluated;
4. provide the same version to the preflight with `--version` or `KNOWME_RELEASE_VERSION`.

No Prisma migration and no product/user data migration are required.

## Rollback

Revert KMD-254 to restore schema version 1. Doing so weakens release traceability because evidence could again be accepted without an explicit production target/version binding; a rollback must not be used to claim equivalent market-readiness assurance.

## Validation

The market evidence test suite covers:

- a complete WEB_V1 production release candidate;
- FULL scope requirements;
- wrong/non-production environment;
- missing or mismatched expected release version;
- non-canonical manifest and expected versions;
- rejection of the previous schema version;
- all existing commit, expiry, metadata and SHA-256 integrity checks.

The repository CI gate must pass on the exact KMD-254 head before merge.

## Proof boundary

This change validates consistency and traceability of the evidence manifest. It does not prove that production deployment occurred, that the declared version was actually deployed, that retained evidence is truthful, or that legal, physical-device, store, backup/restore, monitoring or antimalware checks happened. Those remain external release evidence that must be genuinely produced and reviewed.
