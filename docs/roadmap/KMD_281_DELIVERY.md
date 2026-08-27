# KMD-281 — Market-ready retained bundle gate

## Goal

Prevent `pnpm check:market-ready` from accepting only a valid signed release-evidence manifest while the retained digest and authenticated verification receipt are missing, stale, substituted, or inconsistent with the exact artifact being released.

## Delivered behavior

`check:market-ready` now keeps all existing release configuration and signed-manifest validation and additionally runs `scripts/market-release-evidence-retained-bundle-preflight.mjs`.

The retained-bundle gate requires three distinct release artifacts:

- `KNOWME_RELEASE_EVIDENCE_FILE` — the signed canonical market-evidence manifest;
- `KNOWME_RELEASE_EVIDENCE_DIGEST_FILE` — the canonical SHA-256 digest file generated for that manifest;
- `KNOWME_RELEASE_EVIDENCE_RECEIPT_FILE` — the authenticated verification receipt generated from the retained bundle.

CLI `--manifest`, `--digest`, and `--receipt` arguments may be used for an explicit operator invocation.

The gate reuses the already merged KMD-272→277 verification chain. It therefore validates the exact retained bytes, manifest HMAC, digest, authenticated receipt, release commit, release version, signing-key identity, scope, required evidence, evidence expiry, receipt-to-bundle path binding, and the configured `KNOWME_RELEASE_RECEIPT_MAX_AGE_HOURS` freshness policy.

The three paths must be present and distinct. Missing or ambiguous artifact paths fail closed.

## Tests

The root `pnpm test` suite now includes `market-release-evidence-retained-bundle-preflight.test.mjs` covering:

- a valid exact retained bundle;
- a missing receipt/manifest/digest path;
- one path reused for multiple release artifacts;
- a digest no longer matching the signed manifest bytes;
- an otherwise authentic bundle whose verification receipt is older than the configured freshness window.

The existing repository CI remains authoritative for the complete build/unit/Web E2E/API E2E gate.

## Migration

No Prisma, database, or user-data migration is required.

Release automation that invokes `pnpm check:market-ready` must now retain and provide the signed manifest, its digest file, and the authenticated receipt together instead of supplying only `KNOWME_RELEASE_EVIDENCE_FILE`.

## Rollback

Revert KMD-281. The older gate will again validate the signed manifest without requiring proof that the retained digest and authenticated receipt still correspond to the same exact release bundle.

## Proof boundary

KMD-281 proves repository-level cryptographic and byte-level consistency of the retained release-evidence bundle at market-readiness time. It does not prove that external evidence is truthful, that artifacts are stored on immutable/WORM infrastructure, that production DNS/TLS is correct, that a restore drill happened, that monitoring/on-call is active, that legal review is valid, that the antimalware provider is production-ready, that physical iOS/Android tests occurred, or that stores accepted/published the release.
