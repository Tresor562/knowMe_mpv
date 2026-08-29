# KMD-319 — harden standalone manual promotion preflight file reads

## Goal

Close the remaining filesystem and memory-safety gap in `release:evidence:manual:promotion:preflight`. Before KMD-319, the batch/finalize loader used the KMD-317/KMD-318 descriptor-bound, anti-symlink, bounded reader, while the standalone preflight CLI still used unrestricted `readFile()` calls.

## Implementation

KMD-319 adds `scripts/retained-evidence-safe-read.mjs` as the common retained-evidence reader used by both the standalone promotion preflight and the FULL batch/finalize chain loader.

The shared reader:

- requires regular non-symlink files;
- uses `O_NOFOLLOW` when the runtime provides it;
- compares `(dev, ino)` before and after opening and after reading;
- reads from the already-validated descriptor rather than reopening the path;
- reads in 64 KiB chunks with an authoritative byte counter;
- rejects files that exceed their configured limit before, during, or after the read;
- closes descriptors in `finally`.

Configured limits are now centralized:

- serialized manual evidence item: 2 MiB;
- retained artifact: 256 MiB;
- worksheet: 2 MiB;
- human review receipt: 1 MiB.

The standalone CLI now also emits explicit JSON parse errors for the item and review receipt after safe bounded reads. The existing promotion reconstruction, release binding, retained-proof hashing, human-review contract, and process-local authorization semantics remain unchanged.

## Tests

`retained-evidence-safe-read.test.mjs` covers:

- successful regular-file reads within bounds;
- oversized-file rejection;
- symbolic-link rejection;
- invalid limit rejection.

The suite is imported by the already-root-gated `manual-release-evidence-promotion-preflight.test.mjs`, so the regressions execute under the repository `pnpm test` gate without introducing a separate untracked test entry.

Existing KMD-316 through KMD-318 chain-loader tests continue to exercise batch/finalize behavior against the same shared reader.

## Migration

No Prisma migration, user-data migration, product API migration, manifest-schema migration, or operator directory-layout migration is required.

Operators do not need to change the existing manual evidence directory structure. A standalone item larger than 2 MiB is now rejected, which is intentionally far above the expected serialized evidence item size.

## Rollback

Revert KMD-319. This would restore duplicated reader logic and return the standalone promotion CLI to unrestricted `readFile()` behavior. KMD-317/KMD-318 protections in the batch/finalize loader would remain only if the refactor portion is also reverted carefully. Because rollback reopens an avoidable memory/symlink/TOCTOU boundary in the standalone CLI, it should be used only for a demonstrated compatibility incident.

## Proof boundary

This software guard does not establish that physical iOS/Android validation occurred, that App Store or Google Play submission occurred, that legal/privacy review occurred, or that production was deployed. Those remain external evidence requirements and must not be inferred from a successful software preflight.
