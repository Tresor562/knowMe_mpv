# KMD-282 — Retained release evidence file safety

## Goal

Harden the KMD-281 market-readiness retained-bundle gate so it cannot blindly load arbitrary filesystem objects or unbounded files before cryptographic validation.

## Delivered behavior

`pnpm check:market-ready` still requires the exact signed manifest, digest, and authenticated receipt introduced by KMD-281. Before those bytes reach the KMD-272→277 cryptographic verification chain, the retained-artifact reader now enforces a filesystem boundary:

- each artifact path must resolve to a regular file;
- symbolic links are rejected before reading, with `O_NOFOLLOW` used where the runtime exposes it;
- the file opened must match the device/inode observed immediately before opening;
- the file must remain the same size and modification timestamp through the read;
- empty artifacts are rejected;
- artifact sizes are bounded before content is loaded into memory.

The explicit budgets are:

- signed manifest: 256 KiB maximum;
- authenticated receipt: 128 KiB maximum;
- digest file: 512 bytes maximum.

These limits are intentionally far above the normal canonical KnowMe artifacts while preventing a release gate from reading an arbitrarily large file because of a bad path or filesystem substitution.

The existing cryptographic controls remain authoritative after the filesystem checks: manifest HMAC, canonical digest, receipt HMAC, commit, version, signing-key identity, scope, required evidence, evidence validity, retained path binding, and receipt freshness are all still verified.

## Tests

The root `pnpm test` suite now includes `scripts/market-release-evidence-retained-file-safety.test.mjs`, covering:

- a normal bounded regular file;
- bounded UTF-8 digest reads;
- empty files;
- oversized files;
- the exact byte-limit boundary;
- directories;
- symbolic links on platforms where symlink creation is available;
- invalid byte budgets.

The repository CI remains authoritative for full build, unit, Chromium Web E2E, PostgreSQL migration/drift, and API E2E validation.

## Migration

No Prisma, database, environment-variable, or user-data migration is required.

Release automation must retain ordinary regular files for the signed manifest, digest, and authenticated receipt. Symlink-based artifact layouts must be replaced with direct retained files before adopting KMD-282.

## Rollback

Revert KMD-282. KMD-281 will continue to cryptographically validate the retained bundle, but its CLI will again read the three supplied paths without explicit regular-file, symlink, mutation, or byte-budget checks.

## Proof boundary

KMD-282 hardens local filesystem reads performed by the repository market-readiness gate. It does not prove immutable/WORM storage, remote artifact durability, external evidence truthfulness, deployment correctness, DNS/TLS, restore drills, monitoring/on-call, legal validity, production antimalware validation, physical device testing, or store publication.
