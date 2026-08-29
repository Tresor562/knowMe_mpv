# KMD-318 — bound retained manual evidence file sizes

## Goal

Prevent the FULL manual release-evidence loader from consuming unbounded memory while reading retained artifacts, worksheets, or human-review receipts before promotion preflight.

## Implementation

The retained-chain loader now applies explicit per-file limits before and during reads:

- retained artifact: 256 MiB;
- worksheet: 2 MiB;
- human review receipt: 1 MiB.

The loader rejects an oversized file from pre-open metadata, re-checks the opened descriptor size, and reads in bounded 64 KiB chunks so a file that grows after `fstat()` cannot make `FileHandle.readFile()` allocate without bound. The byte counter is authoritative during the read and rejects once the configured maximum would be exceeded.

KMD-317 descriptor identity and anti-symlink checks remain intact before, during, and after the bounded read. KMD-313/KMD-314 promotion authenticity and KMD-315 process-local authorization remain unchanged after bytes are loaded.

## Security and reliability properties

- Retained manual evidence can no longer trigger an unbounded whole-file read in the release operator process.
- Metadata and artifact limits are explicit and reviewable rather than implicit runtime memory limits.
- Growth after the initial stat remains bounded by the streaming byte counter.
- Oversized metadata is rejected before JSON parsing or promotion.
- Non-manual / WEB_V1 evidence behavior is unchanged.

## Tests

The manual chain-loader suite keeps its authentic-chain, tamper, symlink, missing-directory, and non-manual coverage and adds a regression proving that a review receipt one byte above its configured limit is rejected before promotion.

Repository CI must remain green on the exact KMD-318 head before merge.

## Migration

No Prisma migration, user-data migration, product API migration, manifest-schema migration, or operator directory-layout migration is required.

Operators retaining unusually large proof bundles must keep each individual retained artifact at or below 256 MiB. Larger source material should be archived externally and represented by a retained evidence artifact suitable for the existing evidence URI/hash contract rather than increasing process memory exposure silently.

## Rollback

Revert KMD-318. KMD-317 remains in place, but retained evidence returns to whole-file reads with no explicit size ceiling. Because that restores memory-exhaustion exposure, rollback should only be used for a demonstrated compatibility incident and should not weaken KMD-313 through KMD-317 authorization or filesystem controls.

## Proof boundary

This software guard does not establish that physical iOS/Android validation occurred, that App Store or Google Play submission occurred, that legal/privacy review occurred, or that production was deployed. Those remain external evidence requirements.
