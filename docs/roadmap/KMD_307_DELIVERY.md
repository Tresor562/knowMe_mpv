# KMD-307 — Manual release evidence human-review receipt

## Goal

Create a traceable, release-bound record of the human retained-proof review that must occur after KMD-306 preflight and before generic FULL-scope evidence is promoted to `VERIFIED`.

## Delivered

- `release:evidence:manual:review` creates a structured human-review receipt for one canonical physical-device or store-submission evidence item.
- The complete worksheet must first pass the KMD-306 fail-closed preflight.
- The selected retained artifact is hashed again and must exactly match the worksheet `retainedProof.sha256`.
- Review metadata requires a canonical reviewer/role and UTC review timestamp that is not materially in the future.
- The receipt remains bound to release commit, release version, evidence id, proof URI, proof SHA-256, validation occurrence time, accountable actor/role, and attestation count.
- The receipt explicitly carries `certifiesExternalValidation: false`; it records review traceability and approval for the evidence pipeline, not independent proof that the external event occurred.
- Output creation uses exclusive file creation and restrictive permissions where supported.

## Required operating sequence

1. Generate the KMD-305 worksheet.
2. Perform the real physical-device validation or store submission.
3. Complete every canonical worksheet field and retain the actual proof artifact.
4. Pass `release:evidence:manual:preflight` from KMD-306.
5. A human reviewer inspects the retained artifact and runs `release:evidence:manual:review` against that exact file.
6. Only after that review may the existing generic FULL-scope evidence-item pipeline be used.
7. Apply evidence to the unsigned manifest, sign, verify retained bundle, and run `check:market-ready`.

## Proof boundary

A generated receipt does **not** certify that a device test occurred, that a store submission occurred, that the retained artifact is truthful, or that KnowMe is market-ready. It proves only that the repository's structural preflight passed, the reviewed file's digest matches the worksheet, and an identified reviewer recorded approval for continued evidence processing.

## Migration

No Prisma migration. No user-data migration. Existing manifests, signatures, evidence items, retained bundles, devices, and store state are unchanged.

## Rollback

Revert KMD-307 and remove the root command/test registration plus the KMD-307 script, tests, and documentation. No production data rollback is required.
