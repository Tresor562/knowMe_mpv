# KMD-269 — Generic market release evidence item builder

## Goal

Remove the remaining manual SHA-256/transcription step when converting a real external release-proof artifact into the bounded `VERIFIED` evidence item consumed by the market-release manifest, without claiming that the artifact is truthful or that KnowMe is market-ready.

## Delivered

- Adds `pnpm release:evidence:item:create`.
- Reads the exact artifact bytes and computes their SHA-256 directly.
- Produces only the strict release-evidence item fields: `id`, `status`, `verifiedAt`, `validUntil`, `verifier`, `evidenceRef`, and `evidenceSha256`.
- Forces `status=VERIFIED` only after the caller supplies the external verification metadata explicitly.
- Reuses the canonical `requiredEvidenceForScope()` contract so WEB_V1 cannot create FULL-only mobile/store evidence.
- Requires canonical UTC timestamps and rejects future/expired evidence.
- Requires a bounded canonical verifier.
- Requires a credential-free `https:` or `evidence:` reference without query string, fragment, or control characters.
- Writes the item with exclusive creation (`wx`) and restrictive permissions where supported.
- Leaves application to the manifest, manifest signing, and `check:market-ready` as separate mandatory gates.

## Tests

The root `pnpm test` gate now covers:

- SHA-256 over the exact bytes rather than normalized text;
- common WEB_V1 evidence creation;
- rejection of FULL-only evidence in WEB_V1 and acceptance in FULL;
- unsafe evidence references and non-canonical verifiers;
- future, expired, and non-canonical timestamps;
- unknown evidence IDs and invalid artifact input.

## Migration

No Prisma migration is required. Release operators can adopt the new command for any external proof artifact before running `release:evidence:item:apply`.

Example sequence:

1. Preserve the real proof artifact in the approved evidence store.
2. Run `pnpm release:evidence:item:create --artifact <file> --output <item.json> --id <required-id> --scope WEB_V1|FULL --verifier <operator> --ref <stable-evidence-uri> --verified-at <UTC> --valid-until <UTC>`.
3. Apply the generated item to the unsigned manifest with `release:evidence:item:apply`.
4. Sign the completed manifest with `release:evidence:sign`.
5. Run `check:market-ready` against the exact release commit/version.

## Rollback

Revert KMD-269. KMD-268 remains available and evidence items can be prepared manually before application, signing, and validation.

## Proof boundary

KMD-269 hashes the exact artifact bytes and validates metadata shape. It does **not** decide whether the underlying evidence is genuine, sufficient, legally approved, physically observed, or still operationally true. It does not perform a production deployment, TLS/DNS verification, restore drill, external monitoring/on-call validation, legal/privacy review, antimalware provider validation, physical iOS/Android testing, or store submission. Those remain external proof obligations and must not be marked VERIFIED without real evidence.