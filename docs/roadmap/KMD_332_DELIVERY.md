# KMD-332 — Harden privacy/legal evidence binder ingestion

## Problem

The production privacy/terms legal-review artifact builder was hardened in KMD-331, but the downstream `privacy_terms_legal_review` evidence binder still loaded its retained artifact with path-based `readFile()`. That left this release-evidence hop outside the descriptor-bound retained-evidence reader already used by other hardened release paths.

## Delivery

- `scripts/privacy-terms-legal-review-evidence-binding.mjs` now reads `--artifact` through `readRetainedEvidenceFile()`.
- The existing shared artifact ceiling (`RETAINED_EVIDENCE_FILE_LIMITS.artifact`, 256 MiB) is applied before semantic validation and evidence-item creation.
- The binder therefore inherits the shared regular-file requirement, symlink rejection, `O_NOFOLLOW` protection where available, bounded descriptor reads, and stability checks around the retained file.
- The legal-review semantic contract, exact schema, canonical proof boundary, digest binding, output `wx` behavior, evidence id, and validity semantics are unchanged.

## Validation

The existing unit coverage remains and CLI regression coverage now proves:

1. a regular retained legal-review artifact can create a VERIFIED `privacy_terms_legal_review` item;
2. a symlinked retained legal-review artifact is rejected before JSON ingestion;
3. rejection does not create the requested output item.

Repository CI must succeed on the exact pull-request head before merge.

## Migration

No Prisma migration, user-data migration, API migration, manifest-schema migration, or operator-layout migration is required.

## Rollback

Revert the KMD-332 commits. This restores the previous path-based read without changing stored data or release manifest schemas.

## Proof boundary

KMD-332 hardens ingestion of a retained legal-review artifact. It does not perform, approve, or certify a legal review; it does not establish regulatory compliance; and it does not prove physical-device validation, production deployment, App Store submission, or Google Play submission.
