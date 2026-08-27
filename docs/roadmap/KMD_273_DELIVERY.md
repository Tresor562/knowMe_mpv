# KMD-273 — Market release bundle verification receipt

## Goal

Create a small, immutable operational receipt only after the signed market-release evidence bundle has passed the full KMD-272 verifier. The receipt makes the exact software verification event auditable without claiming that external evidence has been independently re-proven.

## Delivered

- Adds `pnpm release:evidence:bundle:receipt`.
- Reuses the canonical KMD-272 bundle verifier before producing any receipt.
- Binds the receipt to the exact release commit, release version, scope, signing-key id, signed-manifest SHA-256, and digest-record SHA-256.
- Records a canonical verification timestamp and a fixed proof-boundary statement.
- Rejects ambiguous/control-character artifact paths.
- Creates the receipt exclusively and with restrictive permissions where supported.
- Cleans a partially created receipt if the write/sync operation fails.
- Adds regression coverage to the root `pnpm test` gate.

## Migration

No Prisma or user-data migration is required.

Suggested release flow after KMD-273:

1. finalize the signed evidence bundle;
2. verify the bundle;
3. generate the verification receipt;
4. retain the signed manifest, digest record, receipt, and the real external evidence artifacts together in the release archive.

The receipt itself must not replace the source evidence artifacts.

## Rollback

Revert KMD-273. Continue using `pnpm release:evidence:bundle:verify` from KMD-272 and retain its command output in the release runbook. No database rollback is required.

## Proof boundary

A valid KMD-273 receipt proves that KnowMe's software verifier accepted the exact signed bundle bytes at a recorded instant and records the exact manifest/digest hashes involved. It does **not** independently prove DNS/TLS, deployment correctness, restore-drill execution, external monitoring/on-call, legal/privacy review, data export/deletion execution, moderation/support operations, antimalware validation, physical Android/iOS testing, or store submission/publication.

Those external facts remain release-blocking until their retained real-world evidence is genuinely verified.
