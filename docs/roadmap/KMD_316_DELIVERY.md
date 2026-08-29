# KMD-316 — retained manual evidence chain loader

## Goal

Restore safe operator support for FULL manual evidence in the batch and finalize CLIs after KMD-315 made process-local reviewed authorizations mandatory.

KMD-316 does not weaken KMD-315. It reconstructs each authorization inside the same Node.js process from the exact retained proof bytes, worksheet bytes, human-review receipt, evidence item, target release commit, and target release version.

## Operator layout

For each manual evidence id present in the item set, `--manual-chain-dir <root>` must contain:

```text
<root>/
  ios_physical_validation/
    artifact
    worksheet.json
    review-receipt.json
  android_physical_validation/
    artifact
    worksheet.json
    review-receipt.json
  ios_store_submission/
    artifact
    worksheet.json
    review-receipt.json
  android_store_submission/
    artifact
    worksheet.json
    review-receipt.json
```

Only directories for manual ids actually present in the batch are read. The retained artifact intentionally has the fixed filename `artifact`; its original extension is irrelevant because the pipeline binds exact bytes and SHA-256, not a media type inferred from a filename.

The three retained-chain files must be regular files and may not be symbolic links.

## CLI behavior

### Batch apply

```bash
pnpm release:evidence:batch:apply -- \
  --manifest <unsigned-manifest.json> \
  --items-dir <evidence-items-dir> \
  --manual-chain-dir <retained-chain-root> \
  --commit <release-commit> \
  --version <release-version> \
  --output <updated-unsigned-manifest.json>
```

If no FULL manual item is present, `--manual-chain-dir` is not required and existing WEB_V1/non-manual behavior is unchanged.

### Finalize

```bash
pnpm release:evidence:finalize -- \
  --manifest <unsigned-manifest.json> \
  --items-dir <evidence-items-dir> \
  --manual-chain-dir <retained-chain-root> \
  --commit <release-commit> \
  --version <release-version> \
  --output <signed-manifest.json> \
  --digest-output <signed-manifest.sha256>
```

The signing key id/key remain supplied through the existing server/operator environment variables.

## Security properties

- Manual FULL items still require an authorization minted by `preflightManualReleaseEvidencePromotion` in the current process.
- The loader reads the retained artifact, worksheet, and human-review receipt and reruns the complete promotion preflight.
- A missing retained chain, altered retained proof, altered worksheet, altered receipt, item drift, commit drift, or version drift fails closed before batch mutation or final signing.
- Authorizations remain non-serializable process-local capabilities backed by the KMD-314/KMD-315 `WeakSet`; the loader returns the original minted objects rather than JSON representations.
- WEB_V1 and non-manual evidence do not gain new trust paths.

## Tests

`manual-release-evidence-chain-loader.test.mjs` covers:

- successful reconstruction of an authentic process-local authorization;
- rejection when retained proof bytes drift after review;
- fail-closed behavior when a manual item is present without `--manual-chain-dir`;
- unchanged behavior for non-manual evidence.

The suite is registered in the root `pnpm test` command alongside the existing promotion, item-apply, batch, and finalize suites.

## Migration

No Prisma migration, user-data migration, manifest-schema migration, or product API migration is required.

Operational migration only: FULL release operators using the batch/finalize CLIs must arrange the retained chain in the directory layout above and pass `--manual-chain-dir`.

## Rollback

Revert the KMD-316 commits. KMD-315 remains fail-closed, so rollback removes the convenience loader and causes FULL manual batch/finalize CLI flows to reject again rather than silently bypassing review authorization.

## Validation state

A direct local clone/test attempt from the execution environment could not run because DNS resolution for `github.com` failed. This is an environment/network limitation, not a passing validation. Repository GitHub Actions must therefore complete successfully on the exact KMD-316 head before merge.

## Proof boundary

This software work does not prove that any iOS/Android physical-device validation occurred, that App Store/Google Play submission occurred, that a legal review occurred, or that production was deployed. Those claims still require their real retained external evidence and accountable human review.
