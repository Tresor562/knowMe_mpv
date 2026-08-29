# KMD-333 — Harden data lifecycle evidence binder ingestion

## Problem

The retained production data export/delete smoke artifact is part of KnowMe's launch-critical privacy and data-lifecycle evidence chain. Its evidence binder still loaded `--artifact` with path-based `readFile()`, leaving that hop outside the descriptor-bound retained-evidence reader already used by hardened release paths.

## Delivery

- `scripts/data-export-delete-smoke-evidence-binding.mjs` now reads `--artifact` through `readRetainedEvidenceFile()`.
- The shared artifact ceiling (`RETAINED_EVIDENCE_FILE_LIMITS.artifact`, 256 MiB) is applied before JSON parsing, semantic validation, digest binding, or VERIFIED item creation.
- The binder therefore inherits the shared regular-file requirement, symlink rejection, `O_NOFOLLOW` protection where available, bounded descriptor reads, and retained-file stability checks.
- The KMD-291 data-lifecycle semantic contract, canonical proof boundary, evidence id, digest behavior, validity semantics, and exclusive `wx` output behavior are unchanged.

## Validation

The existing semantic unit coverage remains and CLI regression coverage now proves:

1. a regular retained data export/delete artifact can create a VERIFIED `data_export_delete_validation` evidence item;
2. a symlinked retained data-lifecycle artifact is rejected before JSON ingestion;
3. rejection does not create the requested output item.

Repository CI must succeed on the exact pull-request head before merge.

## Migration

No Prisma migration, user-data migration, API migration, manifest-schema migration, or operator-layout migration is required.

## Rollback

Revert the KMD-333 commits. This restores the previous path-based read without changing stored application data, the KMD-291 artifact schema, or release-manifest schemas.

## Proof boundary

KMD-333 hardens ingestion of retained export/delete evidence. It does not itself run a production export or deletion, prove deletion from third-party/provider backups, establish legal compliance, certify a privacy review, validate physical devices, deploy production, or submit KnowMe to an app store.
