# KMD-279 — Release receipt overwrite cleanup safety

## Goal

Protect retained authenticated market-release receipts from accidental deletion when exclusive output creation refuses to overwrite an existing artifact.

## Problem

`writeMarketReleaseEvidenceBundleReceipt()` correctly opened its output with `wx`, but its generic error cleanup unlinked `outputPath` even when `open(..., 'wx')` failed with `EEXIST`. In that case this invocation had not created the file, so cleanup could delete a pre-existing retained release receipt.

## Delivered

- track whether the current invocation actually created the output file;
- cleanup only artifacts created by that invocation;
- preserve the existing `wx` no-overwrite contract;
- preserve restrictive `0600` permissions, fsync, HMAC, exact-byte and candidate-binding behavior;
- regression test writes one receipt, attempts a different overwrite, expects `EEXIST`, and proves the original bytes remain unchanged.

## Migration

No Prisma, schema, environment, or user-data migration is required. The fix changes only failure cleanup semantics for the release-receipt writer.

## Rollback

Revert KMD-279. This is not recommended because it restores a data-loss risk for retained release evidence when an output path already exists.

## Proof boundary

KMD-279 proves the repository writer preserves an existing receipt during an overwrite attempt under the tested filesystem semantics. It does not prove durable external storage, immutability/WORM retention, off-site replication, operator access controls, or the truthfulness of underlying release evidence.
