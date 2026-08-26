# KMD-263 — Production deployment smoke verifier

## Goal

Turn KMD-262's observable runtime release identity into a deterministic, fail-closed production smoke check that can prove the deployed API is healthy and is running the exact release candidate operators intended to deploy.

## Delivered

- `pnpm release:smoke` verifies the production `/health/ready` endpoint.
- The production base URL must be a canonical HTTPS origin with no credentials, path, query, or fragment.
- Redirects are rejected rather than followed.
- The response must be HTTP 200, JSON, bounded to 64 KiB, and report `status=ready`, `service=knowme-api`, and `checks.database=up`.
- The runtime `{ commit, version }` exposed by KMD-262 must exactly match the expected lowercase 40-character Git SHA and canonical SemVer release version.
- Network timeout is bounded to 500-10000 ms, with a 5000 ms default.
- Unit tests cover URL safety, exact identity matching, readiness/database checks, response type/size, invalid JSON, HTTP failures, and non-canonical release inputs.

## Usage

```text
pnpm release:smoke -- --url https://knowme.example --commit <40-char-sha> --version 1.0.0-rc.1
```

Equivalent environment variables are supported for controlled release automation:

```text
KNOWME_PRODUCTION_BASE_URL=https://knowme.example
KNOWME_RELEASE_COMMIT=<40-char-sha>
KNOWME_RELEASE_VERSION=1.0.0-rc.1
KNOWME_PRODUCTION_SMOKE_TIMEOUT_MS=5000
```

`GITHUB_SHA` may supply the expected commit when `KNOWME_RELEASE_COMMIT` is absent.

## Migration

No database migration is required. Release operations should run this command only after the candidate has actually been deployed and KMD-262 runtime identity variables have been configured on that deployment.

The resulting command output is not itself inserted into the signed market evidence manifest. Operators must retain a real smoke-test artifact/log, hash it, and reference that retained artifact when marking `production_deployment_smoke` as `VERIFIED`.

## Rollback

Revert KMD-263. This removes the smoke command and its tests without changing the running API, database, or market evidence schema.

## Proof boundary

A passing smoke verifies only what is observed over the configured HTTPS endpoint at the time of execution: API readiness, database readiness signal, and exact runtime commit/version identity. It does not prove DNS ownership, certificate governance, firewall/CDN configuration, backup restoration, monitoring/on-call delivery, legal review, antimalware provider operation, physical-device validation, or store publication.
