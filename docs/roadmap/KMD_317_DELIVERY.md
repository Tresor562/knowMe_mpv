# KMD-317 — harden retained manual evidence file reads

## Goal

Close the time-of-check/time-of-use gap in the KMD-316 retained manual evidence chain loader. KMD-316 rejected symbolic links with `lstat()` before calling `readFile()`, but an attacker with filesystem write access could theoretically replace a checked path between those two operations.

## Implementation

Retained `artifact`, `worksheet.json`, and `review-receipt.json` files are now opened through a file descriptor using read-only flags and `O_NOFOLLOW` where the runtime exposes it.

For each file the loader:

1. performs a bigint `lstat()` and requires a regular, non-symlink file;
2. opens the path read-only, adding `O_NOFOLLOW` when available;
3. `fstat()`s the opened descriptor and requires the opened `(dev, ino)` identity to match the pre-open path identity;
4. reads bytes from that already-open descriptor rather than reopening the pathname;
5. performs a post-read `lstat()` and requires the path to remain a regular non-symlink with the same `(dev, ino)` identity;
6. closes the descriptor in a `finally` block.

A symbolic-link loop reported by the OS as `ELOOP` is normalized to the existing fail-closed non-symlink error.

## Security properties

- The loader no longer validates one filesystem object and then independently reopens a pathname for the actual proof bytes.
- Direct symbolic links remain rejected.
- Replacement of the retained path before open, during open, or during the read is rejected when file identity no longer matches.
- Manual evidence still passes through the KMD-313/KMD-314 promotion preflight and KMD-315 process-local authorization gate after bytes are read.
- No additional trust is granted to WEB_V1 or non-manual evidence.

## Tests

The existing KMD-316 chain-loader suite remains part of root `pnpm test` and now also verifies that replacing the retained artifact with a symbolic link is rejected. The symlink-specific test is skipped on Windows because creating symlinks can require privileges unavailable to CI runners; the production guard itself remains active on every platform.

## Migration

No Prisma migration, user-data migration, product API migration, manifest-schema migration, or operator layout change is required.

## Rollback

Revert KMD-317. KMD-316 remains operational but returns to the earlier `lstat()` followed by pathname `readFile()` behavior. Because this weakens filesystem race resistance, rollback should be used only for an identified compatibility regression and should keep KMD-315's authorization gate intact.

## Validation requirements

Merge only after repository CI is green on the exact KMD-317 head. If GitHub Actions is unavailable, run the root test/build/migration gates through another trusted environment and record precisely what could not be verified.

## Proof boundary

This software hardening does not prove that physical iOS/Android validation happened, that App Store or Google Play submission happened, that legal review happened, or that production was deployed. Those remain external evidence requirements and must not be inferred from this change.
