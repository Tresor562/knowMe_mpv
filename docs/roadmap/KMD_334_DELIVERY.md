# KMD-334 — Harden antimalware evidence binder ingestion

## Problem

The retained antimalware-provider smoke artifact is launch-critical security evidence. Its evidence binder still loaded `--artifact` with path-based `readFile()`, leaving this hop outside the descriptor-bound retained-evidence reader already adopted by hardened release paths.

## Delivery

- `scripts/antimalware-provider-smoke-evidence-binding.mjs` now reads `--artifact` through `readRetainedEvidenceFile()`.
- The shared artifact ceiling (`RETAINED_EVIDENCE_FILE_LIMITS.artifact`, 256 MiB) is applied before JSON parsing, semantic validation, digest binding, or VERIFIED item creation.
- The binder inherits the shared regular-file requirement, symlink rejection, `O_NOFOLLOW` protection where available, bounded descriptor reads, and retained-file stability checks.
- The KMD-278 antimalware smoke schema, canonical benign/EICAR checks, provider-reference digests, proof-boundary semantics, evidence id, digest behavior, validity semantics, and exclusive `wx` output behavior are unchanged.

## Validation

The existing semantic unit coverage remains and CLI regression coverage now proves:

1. a regular retained antimalware smoke artifact can create a VERIFIED `antimalware_provider_validation` evidence item;
2. a symlinked retained antimalware artifact is rejected before JSON ingestion;
3. rejection does not create the requested output item.

Repository CI must succeed on the exact pull-request head before merge.

## Migration

No Prisma migration, user-data migration, API migration, manifest-schema migration, or operator-layout migration is required.

## Rollback

Revert the KMD-334 commits. This restores the previous path-based read without changing stored application data, the KMD-278 artifact schema, or release-manifest schemas.

## Proof boundary

KMD-334 hardens ingestion of retained antimalware-provider evidence. It does not itself call or certify a real antimalware provider, prove that production uploads are scanned, establish legal or privacy compliance, validate physical devices, deploy production, or submit KnowMe to an app store.
