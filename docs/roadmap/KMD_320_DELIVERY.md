# KMD-320 — detect in-place retained evidence mutation

## Goal

Close the remaining same-inode mutation gap in the shared retained-evidence reader introduced by KMD-319. Identity checks based only on `(dev, ino)` detect path replacement, but a retained evidence file could still be modified in place while keeping the same inode during a read.

## Implementation

KMD-320 strengthens `scripts/retained-evidence-safe-read.mjs` with a stable retained-evidence file-state fingerprint composed of:

- device ID;
- inode;
- byte size;
- modification time in nanoseconds;
- status-change time in nanoseconds.

The reader now requires the state observed by the initial `lstat()`, the state on the opened descriptor, the descriptor state after the bounded read, and the final path `lstat()` to remain identical. This adds a descriptor-after-read check specifically for in-place mutation and keeps the existing non-symlink, `O_NOFOLLOW`, bounded-read, size-cap and descriptor-close guarantees.

The returned bytes are accepted only after all state checks pass.

## Tests

`retained-evidence-safe-read.test.mjs` now verifies that the stable-state comparison rejects:

- size drift on the same inode;
- modification-time drift on the same inode;
- status-change-time drift on the same inode;
- inode replacement with otherwise matching metadata;
- device replacement with otherwise matching metadata.

Existing regular-file, size-limit, symlink and standalone-CLI regressions remain in the root-gated test chain.

## Migration

No Prisma migration, user-data migration, product API migration, manifest-schema migration or operator directory-layout migration is required.

This is fail-closed hardening only. Operators should ensure retained evidence files are immutable while release preflight or ingestion is running.

## Rollback

Revert KMD-320. This would restore KMD-319 identity-only path stability checks and reopen the same-inode in-place mutation window. Rollback should be reserved for a demonstrated filesystem compatibility issue and must not be used to bypass retained-evidence integrity failures.

## Proof boundary

Filesystem stability checks do not prove that iOS/Android physical validation occurred, that App Store or Google Play submission occurred, that legal/privacy review occurred, or that production was deployed. Those external evidence requirements remain independent and must not be inferred from software preflight success.
