# KMD-335 — Harden production TLS/domain evidence binder ingestion

## Problem

The retained production TLS/domain smoke artifact is launch-critical deployment evidence. Its binder still loaded `--artifact` with a path-based `readFile()`, leaving this retained-evidence hop outside the descriptor-bound reader already adopted by hardened release paths.

## Delivery

- `scripts/production-tls-domain-smoke-evidence-binding.mjs` now reads `--artifact` through `readRetainedEvidenceFile()`.
- The shared artifact ceiling (`RETAINED_EVIDENCE_FILE_LIMITS.artifact`, 256 MiB) is enforced before JSON parsing, semantic validation, digest binding, or VERIFIED item creation.
- The binder inherits the shared regular-file requirement, symlink rejection, `O_NOFOLLOW` protection where available, bounded descriptor reads, and retained-file stability checks.
- The existing production TLS/domain schema, canonical HTTPS origin checks, hostname/port binding, certificate fingerprint and validity semantics, proof boundary, evidence id, digest behavior, validity semantics, and exclusive output behavior are unchanged.

## Validation

Existing semantic tests remain and CLI regression coverage now proves:

1. a regular retained TLS/domain smoke artifact can create a VERIFIED `production_tls_domain` evidence item;
2. a symlinked retained artifact is rejected before JSON ingestion;
3. rejection does not create the requested output item.

Repository CI must succeed on the exact pull-request head before merge.

## Migration

No Prisma migration, user-data migration, API migration, manifest-schema migration, or operator-layout migration is required.

## Rollback

Revert the KMD-335 commits. This restores the previous path-based artifact read without changing stored application data, evidence schemas, or release-manifest schemas.

## Proof boundary

KMD-335 hardens ingestion of retained TLS/domain evidence. It does not itself validate a live production domain, prove DNS ownership, deploy TLS configuration, establish legal/privacy compliance, validate physical devices, deploy production, or submit KnowMe to an app store.
