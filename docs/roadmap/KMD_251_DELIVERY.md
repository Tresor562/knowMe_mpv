# KMD-251 — Market release evidence commit binding

## Goal

Make the market-readiness evidence contract fail closed unless it is explicitly bound to the exact Git commit being released.

KMD-250 introduced a candidate evidence manifest with a `releaseCommit`, but the CLI only compared that value when `GITHUB_SHA` or `KNOWME_RELEASE_COMMIT` happened to be present. Without either variable, a structurally valid manifest for an arbitrary 40-character commit could pass the evidence preflight.

## Delivery

- `validateMarketReleaseEvidence()` now requires an explicit, canonical lowercase 40-character expected commit.
- The manifest `releaseCommit` must match that expected commit exactly.
- The CLI accepts the expected commit from, in priority order:
  1. `--commit <sha>`;
  2. `GITHUB_SHA`;
  3. `KNOWME_RELEASE_COMMIT`.
- The CLI exits before reading/approving evidence if no valid expected commit is available.
- Unit coverage verifies missing, malformed and mismatched expected commits.

## Release usage

For a local or operator-driven candidate check:

```bash
pnpm check:market-ready -- --commit <exact-40-char-release-sha>
```

In CI, `GITHUB_SHA` may provide the binding automatically when it is the exact candidate commit. Operators must not substitute a branch name, shortened SHA, tag label or another commit.

## Migration

No Prisma migration and no product-data changes.

Existing release evidence manifests remain schema version 1. Operators only need to ensure that the market-readiness command is supplied the exact candidate commit through one of the supported binding mechanisms.

## Rollback

Revert the KMD-251 commits. This restores the KMD-250 behavior where commit comparison could be skipped when no expected commit environment variable was supplied. That rollback weakens the release gate and should only be used to diagnose tooling, never to declare a market release ready.

## Proof boundary

KMD-251 proves only that the evidence manifest refers to the exact commit supplied to the checker. It does not prove that the supplied commit is deployed, that the evidence is truthful, or that external legal, physical-device, store, DNS/TLS, backup/restore, monitoring, antimalware or production validations have actually occurred.
