# KMD-272 — Signed market release evidence bundle verifier

## Goal

Verify the final signed market-release evidence artifact and its SHA-256 record as one fail-closed bundle before a release candidate is handed to deployment or archival workflows.

## Delivered

- `pnpm release:evidence:bundle:verify`;
- exact-byte SHA-256 verification of the signed manifest against its digest record;
- strict one-line lowercase SHA-256 digest format with canonical LF line ending;
- exact binding between the digest record path and the manifest path supplied to the verifier;
- rejection of control characters and ambiguous digest paths;
- canonical finalized JSON byte verification;
- full reuse of the market-readiness validator for HMAC authenticity, commit, version, signing-key id, scope, evidence completeness, expiry, and evidence SHA-256 rules;
- regression tests wired into the root `pnpm test` gate.

## Operational adoption

After `pnpm release:evidence:finalize` produces the signed manifest and digest record, verify the retained pair with the same candidate identity and release-evidence signing key configuration:

```bash
pnpm release:evidence:bundle:verify \
  --manifest ./release-evidence.signed.json \
  --digest ./release-evidence.signed.sha256 \
  --commit "$KNOWME_RELEASE_COMMIT" \
  --version "$KNOWME_RELEASE_VERSION"
```

The digest record must name the manifest path exactly as supplied to `--manifest`.

## Migration

No Prisma migration or user-data migration is required. This is release tooling only.

Existing KMD-271 bundles remain valid when their digest record is canonical and names the retained manifest exactly. Release operators should add bundle verification after finalization and before archival/deployment approval.

## Rollback

Revert KMD-272. The KMD-271 finalizer remains available and still produces an authenticated signed manifest plus SHA-256 record. Operators can fall back to an independently documented `sha256sum`/equivalent check plus `pnpm check:market-ready` while the verifier is unavailable.

## Proof boundary

A successful bundle verification proves only that the retained bundle bytes match their digest, are canonical, authenticate under the configured release-evidence HMAC key, and satisfy the software manifest contract for the exact commit/version.

It does **not** prove that any referenced external evidence is truthful or that production DNS/TLS, deployment, restore drills, monitoring/on-call, legal/privacy review, data export/deletion, moderation operations, antimalware provider validation, physical iOS/Android tests, or store submissions actually happened. Those remain real-world evidence requirements.
