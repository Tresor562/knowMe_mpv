# KMD-331 — Harden privacy/legal review artifact ingestion

## Why this milestone exists

The production privacy/terms legal-review artifact builder already rejected obvious symlinks and pre-read oversize inputs, but its four retained inputs were still read with a path-based `readFile()` after an `lstat()` check. That left this release-evidence path outside the descriptor-bound retained-evidence reader used by the newer market-release tooling and therefore exposed it to file replacement or in-place mutation between validation and hashing/parsing.

This is a release-engineering hardening milestone. It does **not** perform or certify a legal review.

## Delivered

- `scripts/privacy-terms-legal-review-artifact.mjs` now reads the retained privacy policy, terms, consent notice, and legal-review record through `readRetainedEvidenceFile()`.
- The existing 2 MiB input ceiling is sourced from `RETAINED_EVIDENCE_FILE_LIMITS.worksheet`.
- The pre-existing requirement that every retained input contain at least one byte is preserved explicitly after the safe-reader migration.
- Existing canonical-path, exact-schema, explicit confirmation, exclusive output creation, digest binding, and proof-boundary behavior remain unchanged.
- The shared safe reader provides regular-file enforcement, symlink refusal, `O_NOFOLLOW` where supported, descriptor-bound bounded reads, and before/opened/after stability checks across device, inode, size, mtime, and ctime.

## Tests

`privacy-terms-legal-review-artifact.test.mjs` retains coverage for:

- the exact six-check production review-record contract;
- unknown/incomplete/future/non-passed review data;
- byte-exact digest binding for the privacy policy, terms, consent notice, and legal-review record;
- mandatory explicit review-completion confirmation;
- symlink rejection and malformed JSON rejection;
- exclusive artifact creation and preservation of a pre-existing output.

KMD-331 adds a regression proving that the former non-empty input contract remains fail-closed after moving to the shared safe reader.

The complete repository CI must pass on the exact PR head before merge.

## Migration

No Prisma migration, database migration, user-data rewrite, API change, manifest-schema change, or operator-layout migration is required.

## Rollback

Revert the KMD-331 commits. No data rollback is required because this milestone changes only retained-file ingestion in the release-evidence CLI.

## Proof boundary

KMD-331 strengthens how retained legal/privacy evidence is ingested. It does not establish legal compliance, regulatory approval, continued validity after product/law changes, physical-device validation, store approval, or production deployment. Those remain external release obligations and must not be claimed without real evidence.
