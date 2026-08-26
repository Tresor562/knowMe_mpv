# KMD-253 — Market release evidence artifact integrity

## Goal

Prevent the market-readiness manifest from referring only to mutable evidence locations without recording a stable content identifier for the retained proof.

## Delivery

- Every required market-release evidence item now requires `evidenceSha256`.
- The digest must be an exact lowercase 64-character SHA-256 value with no surrounding whitespace.
- The checked-in example manifest exposes the field but remains entirely `PENDING`.
- Regression coverage rejects missing, uppercase, short and whitespace-padded digests.

## Operational usage

When a real release proof is retained, hash the exact retained artifact or evidence bundle and record that digest beside its `evidenceRef`. A later reviewer can recompute the SHA-256 from the retained artifact and compare it to the manifest before accepting the proof.

KMD-253 intentionally does not fetch arbitrary external evidence from CI. Fetching private legal documents, device records, incident exports or provider artifacts from the repository runner would create new credential, privacy and network trust boundaries.

## Migration

No Prisma migration and no product-data change.

Existing candidate evidence manifests must add `evidenceSha256` for each required proof before the market-readiness checker can pass.

## Rollback

Revert KMD-253. This restores a weaker contract where an evidence reference can point to mutable content without any recorded content digest. That rollback must not be used to claim market readiness.

## Proof boundary

The digest binds the manifest record to a claimed artifact content hash. It does not independently prove that the artifact exists, that the reference is reachable, that the digest was computed honestly, or that the underlying external validation actually occurred. Those checks remain part of controlled release review.
