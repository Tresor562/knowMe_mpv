# KMD-257 — Market release evidence signing-key version binding

## Objective

Make signed market-release evidence unambiguous across HMAC key rotation. KMD-255 authenticates the manifest and KMD-256 isolates the secret, but a manifest did not identify which release-evidence key version intentionally signed it.

## Delivered boundary

- Market evidence manifests move to `schemaVersion: 4`.
- Every manifest carries a canonical `signingKeyId`.
- `KNOWME_RELEASE_EVIDENCE_SIGNING_KEY_ID` identifies the key expected by the release environment.
- The expected key id must match the manifest exactly.
- `signingKeyId` is part of the canonical HMAC input, so changing it after signing invalidates the manifest.
- Key ids are lowercase canonical identifiers, 1..64 characters, using only `a-z`, `0-9`, `.`, `_`, and `-` after an alphanumeric first character.
- The key id is metadata, not a secret; the HMAC key remains server/release-secret-manager only.

## Tests

The market-release evidence suite covers:

- a valid schema-v4 manifest;
- missing/non-canonical expected key ids;
- missing manifest key id;
- mismatch between manifest and release-environment key identity;
- tampering with a signed key id;
- rejection of the previous schema version;
- all existing commit, version, evidence, validity, digest and HMAC checks.

## Migration

1. Assign a stable non-secret identifier to the active release-evidence signing key, for example `release-evidence-2026-08`.
2. Set `KNOWME_RELEASE_EVIDENCE_SIGNING_KEY_ID` in the protected release environment alongside the existing signing secret.
3. Migrate candidate manifests to schema v4 and add the exact `signingKeyId`.
4. Re-sign each migrated manifest with the intended key. Do not copy an old HMAC into a schema-v4 manifest.
5. During future rotation, issue a new key id and re-sign release evidence intentionally with the newly active key.

## Rollback

Revert KMD-257. That restores schema v3 and removes key-id binding. Existing schema-v4 manifests would then need explicit migration back to v3 and re-signing; do not silently strip the key identity from retained evidence.

## Proof boundaries

This block does **not** prove secret-manager/KMS/HSM custody, ACL separation, actual rotation ceremonies, dual-control, operator identity, the truth of external evidence, production deployment, TLS/DNS, restore drills, monitoring delivery, legal approval, physical device testing, antimalware validation, or store publication.

The release remains blocked unless all external evidence required by the selected market-readiness scope is genuinely verified and retained.
