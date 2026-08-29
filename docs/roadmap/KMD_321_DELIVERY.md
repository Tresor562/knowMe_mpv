# KMD-321 — Harden manual evidence item creation reads

## Goal

Close the remaining unsafe filesystem ingestion path in the operator-facing `release:evidence:item:create` command for FULL physical-device and store-submission evidence.

## Problem

KMD-317 through KMD-320 hardened the shared retained-evidence reader used by manual promotion preflight and batch/finalize loading. The item-creation CLI still used direct `readFile()` calls for the retained artifact, worksheet, and human-review receipt. That left item creation outside the common non-symlink, bounded-size, descriptor-identity, and in-place-mutation protections.

## Delivery

`market-release-evidence-item-create.mjs` now loads all three reviewed inputs through `readRetainedEvidenceFile()` using the canonical limits:

- artifact: 256 MiB;
- worksheet: 2 MiB;
- review receipt: 1 MiB.

The shared reader preserves the KMD-317/318/319/320 protections: regular files only, symlink rejection, `O_NOFOLLOW` when available, bounded descriptor reads, and stable `(dev, ino, size, mtimeNs, ctimeNs)` checks around the read.

The review receipt is parsed only after the secured read. Invalid JSON fails closed with an explicit operator error.

## Tests

A dedicated CLI regression is registered in the root `pnpm test` command. It covers:

1. successful item creation from a valid regular-file reviewed chain;
2. rejection when the retained artifact path is replaced by a symbolic link.

Existing constructor and manual evidence tests remain unchanged and continue to validate review receipt, worksheet, digest, release binding, canonical timestamps, verifier, and evidence URI behavior.

## Migration

No Prisma or data migration. No API, manifest schema, user-data, product-flow, or operator directory-layout change.

Operators keep the same command and arguments. The only behavioral change is fail-closed rejection of retained inputs that violate the shared filesystem safety contract.

## Rollback

Revert the KMD-321 commits. This restores the prior direct-read implementation but also reopens the filesystem-safety gap, so rollback should only be used to diagnose a regression and should not be kept for production release evidence handling.

## Evidence boundary

This change validates how already-retained evidence bytes are read. It does not prove that any iOS/Android physical test, App Store submission, Google Play submission, legal review, production deployment, or other external validation actually occurred.
