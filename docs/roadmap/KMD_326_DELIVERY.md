# KMD-326 — Harden market evidence plan-contract CLI ingestion

## Goal

Close the remaining direct filesystem read in the market-release evidence plan command-contract CLI without changing the pure contract validator or any product/runtime behavior.

## Problem

`release:evidence:plan:contract` accepted an optional package path and loaded it with an unbounded `readFile()` before JSON parsing. The other release-evidence CLIs now use the shared descriptor-bound safe reader, so this operator-facing validation path remained inconsistent: a symlink, path replacement, in-place mutation, or oversized file could reach JSON parsing.

## Delivery

The CLI now reads the supplied package file through `readRetainedEvidenceFile()` before JSON parsing with an explicit 2 MiB ceiling.

It therefore inherits the shared protections already exercised by the release evidence pipeline:

- regular files only;
- symbolic links rejected;
- `O_NOFOLLOW` where available;
- descriptor-bound reads;
- bounded 64 KiB chunking;
- maximum-size enforcement before, during, and after reading;
- `(dev, ino, size, mtimeNs, ctimeNs)` stability checks across opening and reading.

The exported `validateMarketReleaseEvidencePlanCommandContract()` function is unchanged and still validates only the parsed package object and generated action-plan command contract.

## Tests

The existing contract tests remain intact. The suite additionally executes the real CLI and proves that:

1. the repository's regular root `package.json` is accepted;
2. a symlinked package input is rejected before JSON ingestion and produces no success output.

The test file was already part of the root test command, so no test-registration migration is required.

## Migration

No Prisma migration, user-data migration, API contract, release manifest schema, package script contract, or operator directory-layout migration is required.

## Rollback

Revert the KMD-326 commits. This restores the prior direct package-file read for only the plan-contract CLI. No stored data or release manifest is changed by either direction of the rollback.

## Proof boundary

Automated CI can validate repository build/test/E2E gates and the CLI behavior available in GitHub Actions. This KMD does not claim physical iOS/Android validation, legal or privacy approval, App Store/Google Play publication, or production deployment without retained external evidence.
