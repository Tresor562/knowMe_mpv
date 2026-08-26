# KMD-260 — Market release evidence metadata canonicality

## Objective

Make the signed market-readiness manifest fail closed when retained-evidence metadata is ambiguous, oversized, malformed, or embeds credentials.

## Delivered boundary

- `verifier` must be canonical text with no leading/trailing whitespace, no control characters, and a maximum length of 128 characters.
- `evidenceRef` must be a canonical absolute URI between 8 and 2048 characters.
- Evidence references containing embedded URI credentials are rejected.
- Evidence references containing control characters or hidden leading/trailing whitespace are rejected.
- Existing HMAC, exact-schema, commit, version, signing-key-id, expiry and artifact SHA-256 checks remain unchanged.
- The new regression suite is wired into the repository root `pnpm test` gate.

These rules reduce ambiguity in operator identity and retained-evidence references and prevent secrets embedded in URI authority fields from becoming part of the signed release manifest.

## Tests

The dedicated KMD-260 suite covers:

- canonical verifier + `evidence://` URI success;
- verifier leading/trailing whitespace rejection;
- verifier control-character rejection;
- verifier length bound;
- relative evidence-reference rejection;
- embedded URI credential rejection;
- hidden whitespace/control-character rejection;
- evidence-reference maximum length.

## Migration

No Prisma migration is required. Existing release-evidence manifests must use canonical verifier names and absolute evidence URIs before signing. References with embedded credentials must be replaced with credential-free retained-evidence locations.

## Rollback

Revert KMD-260. This restores the previous permissive metadata checks without changing product data, HMAC semantics, stored user data, or any database schema.

## Proof boundaries

This hardening validates only the syntax and boundedness of metadata stored in the signed release manifest. It does not fetch the referenced artifact, prove the identity of the verifier, validate the truth of external evidence, prove production deployment/TLS/monitoring/legal/device/store conditions, or verify secret-manager and access-control policy outside the repository.
