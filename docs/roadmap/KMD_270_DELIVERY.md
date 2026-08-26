# KMD-270 — Atomic market release evidence batch apply

## Goal

Remove the remaining fragile chain of repeatedly applying release-evidence items one by one when assembling a market-release candidate, while preserving the rule that only real externally verified evidence may be marked `VERIFIED`.

## Delivered

- Adds `pnpm release:evidence:batch:apply`.
- Reads a directory of bounded JSON evidence items and applies them to an unsigned schema-v4 release manifest in one atomic in-memory operation.
- Requires the manifest to contain exactly one evidence slot for every ID required by its `WEB_V1` or `FULL` scope.
- Requires the supplied item set to match exactly the slots that are still `PENDING`.
- Rejects missing, duplicate, unknown, out-of-scope, or already-applied evidence items.
- Reuses the KMD-268 single-item validator for commit/version binding, timestamp validity, SHA-256 shape, strict fields, and scope enforcement.
- Leaves already `VERIFIED` slots intact when no replacement item is supplied.
- Writes only a new output file with exclusive creation and restrictive permissions where supported.
- Leaves the resulting manifest unsigned; `release:evidence:sign` and `check:market-ready` remain mandatory.

## Tests

The root `pnpm test` gate now covers:

- complete WEB_V1 batch application;
- preservation of an already verified slot;
- missing evidence rejection;
- duplicate/non-PENDING replacement rejection;
- malformed manifest slot-set rejection;
- FULL-scope coverage.

## Migration

No Prisma migration is required.

Suggested release workflow:

1. Preserve each real proof artifact.
2. Build bounded items with `release:evidence:item:create`.
3. Place only the items for currently `PENDING` slots in a dedicated directory.
4. Run `pnpm release:evidence:batch:apply --manifest <unsigned.json> --items-dir <dir> --output <complete-unsigned.json> --commit <sha> --version <semver>`.
5. Sign the completed manifest with `release:evidence:sign`.
6. Run `check:market-ready` against the exact commit/version.

## Rollback

Revert KMD-270. KMD-268 remains available for deterministic one-item-at-a-time application.

## Proof boundary

KMD-270 only assembles already-created evidence items and prevents partial or mismatched batch application. It does not create external evidence, judge its truthfulness, perform a deployment, validate TLS/DNS, execute a restore drill, prove continuous monitoring/on-call, complete legal/privacy review, validate a production antimalware provider, perform physical iOS/Android testing, or submit/publish store builds. Those obligations remain external and must not be marked `VERIFIED` without real evidence.
