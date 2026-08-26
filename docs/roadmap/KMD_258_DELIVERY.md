# KMD-258 — Market release evidence signing workflow

## Objective

Provide a controlled, reproducible way to sign a complete market-release evidence manifest after KMD-255 through KMD-257 established manifest authenticity, secret isolation and signing-key identity binding.

## Delivered boundary

- Adds `pnpm release:evidence:sign`.
- Requires an explicit input manifest and a distinct output path.
- Refuses to overwrite the source file or an existing output artifact.
- Requires the exact release commit, canonical release version, active signing-key id and dedicated signing secret.
- Computes the HMAC only after binding the candidate to those release coordinates.
- Re-runs the full market-evidence validation after signing and refuses to emit an artifact when any required external evidence is missing, pending, expired, malformed, or mismatched.
- Writes the signed artifact with restrictive file permissions where supported.
- Never prints the signing secret or the manifest HMAC key material.

## Usage

Set the protected release environment variables:

- `KNOWME_RELEASE_EVIDENCE_SIGNING_KEY`
- `KNOWME_RELEASE_EVIDENCE_SIGNING_KEY_ID`
- `KNOWME_RELEASE_VERSION`
- `KNOWME_RELEASE_COMMIT` (or provide `--commit`, or use `GITHUB_SHA`)

Then run for example:

`pnpm release:evidence:sign -- --file evidence.json --out evidence.signed.json --commit <40-char-sha> --version <semver>`

The output file must not already exist.

## Tests

The dedicated suite verifies that:

- a fully verified schema-v4 manifest is signed and then accepted by the existing market-readiness validator;
- pending or incomplete evidence cannot be signed;
- commit, release-version and signing-key-id mismatches fail closed;
- weak signing secrets are rejected;
- the source manifest object is not mutated by the signing helper.

The suite is wired into the root `pnpm test` command.

## Migration

No Prisma migration is required. Release operators should move from ad-hoc/manual HMAC generation to the repository signer and retain the resulting signed artifact together with the external evidence it references.

## Rollback

Revert KMD-258. Existing schema-v4 signed manifests remain valid because this block does not alter the manifest schema or HMAC algorithm; it only adds the controlled signing workflow.

## Proof boundaries

This tooling does not prove the truth of external evidence, KMS/HSM custody, secret-manager ACLs, dual control, operator identity, deployment correctness, TLS/DNS, restore drills, monitoring delivery, legal approval, antimalware validation, physical-device testing or store publication.

A signed manifest is only an authenticated record of the evidence metadata supplied to it. Market readiness remains blocked unless every required external proof is genuinely verified and retained.