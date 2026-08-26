# KMD-255 — Market release evidence manifest authenticity

## Objective

Make the market-readiness evidence manifest tamper-evident. KMD-251 through KMD-254 bind retained evidence to the exact commit, release version, production environment, validity window and artifact SHA-256. KMD-255 additionally authenticates the manifest itself with a dedicated HMAC-SHA-256 key.

## Contract

- `schemaVersion` is now `3`.
- Every candidate manifest must include `manifestHmacSha256` as a lowercase 64-character SHA-256 HMAC.
- The HMAC covers the complete manifest except `manifestHmacSha256` using deterministic canonical JSON with sorted object keys.
- Array order remains significant.
- `KNOWME_RELEASE_EVIDENCE_SIGNING_KEY` is required by `check:market-ready` and must be a canonical secret of at least 32 characters.
- The signing key is never stored in the evidence manifest and must be provided from the release secret-management boundary.
- Signature comparison is timing-safe.
- Any modification to release target, evidence status, reviewer attribution, validity window, evidence reference, artifact digest, scope or environment invalidates the manifest until it is deliberately re-signed.

## Tests

The regression suite covers:

- valid signed WEB_V1 and FULL manifests;
- missing, weak and whitespace-altered signing keys;
- missing and malformed HMAC values;
- tampering with status, verifier, validity window and release version;
- successful validation only after an intentionally modified manifest is re-signed;
- all KMD-251 through KMD-254 commit/version/validity/artifact checks remain enforced.

## Migration

No Prisma or user-data migration is required.

Existing schema-v2 evidence manifests must be upgraded to schema v3 and deliberately signed after their retained evidence has been rechecked. Do not copy the zero HMAC from the example file; it is an intentionally non-valid placeholder attached to PENDING evidence.

The release environment must provide `KNOWME_RELEASE_EVIDENCE_SIGNING_KEY` from a secret manager or equivalent protected release boundary. Do not place the real key in the repository, build logs, issue comments, PR descriptions or evidence artifact itself.

## Rollback

Revert KMD-255 to restore schema v2. This removes manifest authentication and therefore restores the weaker contract where evidence metadata can be edited without a cryptographic authenticity check. A rollback must not be represented as equivalent market-readiness assurance.

## Proof boundary

KMD-255 proves only that a manifest was authenticated by possession of the configured release-evidence signing key and has not changed since that signature was produced. It does not prove that the verifier is legally authorized, that an evidence reference is reachable, that the referenced artifact is truthful, that production was deployed, that legal review happened, that devices/stores were physically validated, or that backup, monitoring, antimalware and incident-response exercises were actually performed.
