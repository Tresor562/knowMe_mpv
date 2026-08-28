# KMD-306 — Manual release evidence worksheet preflight

## Goal

Fail closed before an operator turns physical-device or app-store work into generic `VERIFIED` market evidence. KMD-305 creates a release-bound worksheet, but a filled worksheet previously had no deterministic structural preflight.

## Delivered

- `release:evidence:manual:preflight -- --file <worksheet.json>` validates a completed KMD-305 worksheet.
- The worksheet must remain bound to a canonical FULL release commit/version and preserve `templateOnly: true` plus `certifiesValidation: false`.
- Exactly the canonical iOS physical, Android physical, App Store submission, and Google Play submission entries must be present once each.
- Every entry must be explicitly marked `COMPLETED_MANUAL_VALIDATION`.
- Validation timestamps must be canonical UTC and not materially in the future.
- Accountable actor/role, outcome, retained-proof URI, lowercase SHA-256 digest, every canonical attestation, and every attestation reference are required.
- Proof URIs are limited to credential-free `https:` or `evidence:` references without query strings or fragments.
- Canonical KMD-305 requirements are regenerated from the release metadata, so operators cannot silently weaken the worksheet requirements.

## Proof boundary

Passing this preflight does **not** prove that a device test occurred, that a store submission occurred, that retained proof is authentic, or that KnowMe is market-ready. It only proves that the worksheet is structurally complete and still conforms to the repository contract.

A human reviewer must inspect the retained proof. Only then may the existing generic FULL-scope evidence-item creator be used, followed by manifest application, signing, retained-bundle verification, and `check:market-ready`.

## Migration

No Prisma migration. No user-data migration. Existing unsigned/signed manifests and retained evidence are unchanged.

Operational adoption is additive: generate a KMD-305 worksheet, perform the real external work, fill it, run the KMD-306 preflight, review retained proof, then continue the existing evidence pipeline.

## Rollback

Revert the KMD-306 commits. Remove the root script/test registration and the two KMD-306 files. Existing release manifests, signatures, devices, store state, databases, and user data remain untouched.
