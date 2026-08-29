# KMD-327 — Harden retained bundle receipt reverification reads

## Problem

The retained bundle receipt reverification CLI still used direct `readFile()` calls for the verification receipt, signed manifest, and digest. That made this release gate weaker than the surrounding evidence tooling because those inputs were not protected by the shared descriptor-bound retained-evidence reader.

## Delivery

KMD-327 routes all three CLI inputs through `readRetainedEvidenceFile()` before verification:

- verification receipt: 2 MiB maximum;
- signed release manifest: existing 4 MiB maximum;
- release digest: 64 KiB maximum and UTF-8 decoding after the bounded read.

The shared reader already requires a regular non-symlink file, uses `O_NOFOLLOW` where available, binds reads to the validated descriptor, enforces size ceilings before/during/after reading, and rejects detectable `(dev, ino, size, mtimeNs, ctimeNs)` drift.

The cryptographic receipt/bundle verification contract and freshness policy are unchanged.

## Tests

The existing receipt reverification unit coverage remains in place. A CLI regression now proves that a symlinked receipt is rejected before retained evidence parsing/verification.

The repository CI remains the authoritative full validation gate for this branch.

## Migration

No Prisma migration, user-data migration, API migration, release manifest schema change, or operator directory layout change is required.

## Rollback

Revert the KMD-327 commits. This restores direct file reads but does not require data/schema rollback.

## Evidence boundary

This hardening verifies safer ingestion of retained files only. It does not prove that external evidence is truthful, that physical-device validation occurred, that legal/privacy approval was granted, that production was deployed, or that a store accepted a build.
