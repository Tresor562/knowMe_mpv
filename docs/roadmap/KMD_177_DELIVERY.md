# KMD-177 — Production secret isolation

## Goal

Prevent a market release from reusing one server secret across unrelated trust boundaries. Secret reuse turns one provider, service or operational credential leak into a wider compromise and makes independent rotation unsafe.

## Delivered scope

`pnpm check:release` now checks non-empty production credentials across these boundaries:

- `JWT_SECRET`;
- `METRICS_BEARER_TOKEN`;
- `MEDIA_S3_SECRET_ACCESS_KEY`;
- `STICKER_TOKEN_ACTIVE_SECRET`;
- `ACCOUNT_RECOVERY_SECRET`;
- `ACCOUNT_RECOVERY_EMAIL_API_KEY`;
- `CALL_TURN_SECRET`;
- `NEXUS_KNOWME_SHARED_SECRET` when configured;
- `PAYMENTS_DATA_ENCRYPTION_KEY` when configured;
- `PAYMENTS_FRAUD_HASH_SALT` when configured.

If two configured boundaries use the same value, the release preflight fails closed and reports only the environment variable names. It never places the duplicated secret value in the error output.

The existing minimum-length, HTTPS, CORS, media-storage, recovery, TURN, Nexus and payment checks remain in force.

## Tests

The release-preflight test suite now proves that:

- the hardened reference environment still passes;
- JWT, metrics and TURN credentials cannot share one secret;
- optional Nexus and payment boundaries are checked when configured;
- error messages identify conflicting variable names without reflecting the credential value;
- existing weak-secret and provider configuration failures remain covered.

The repository CI remains the merge gate: install, Prisma setup, monorepo build, unit tests, Chromium Web E2E and PostgreSQL API E2E must pass on the exact PR head.

## Operational procedure

Generate independent random values for every production boundary and store them in the target platform secret manager. Do not derive one secret from another and do not copy a credential merely because two services are owned by KnowMe.

Rotate one boundary at a time using that subsystem's documented compatibility mechanism. Where a subsystem does not yet support overlapping active/previous keys, rotation may invalidate current tokens or sessions and must be planned as an explicit maintenance/security operation.

## Rollback

Revert the KMD-177 commit(s) if the preflight implementation itself causes a regression. Do not work around a failed release by deliberately restoring secret reuse. If an environment is rejected because two credentials are equal, the correct operational fix is to generate and deploy distinct credentials.

## Boundaries and external proof

KMD-177 proves repository-level release validation only. It does **not** prove that:

- a production secret manager is configured;
- credentials have already been rotated in the hosting provider;
- provider IAM permissions are minimal;
- historical leaked credentials have been revoked;
- a complete zero-downtime rotation mechanism exists for every subsystem.

Those remain deployment/security proofs and must not be marked complete without evidence from the target environment.
