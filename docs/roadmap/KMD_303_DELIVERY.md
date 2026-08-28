# KMD-303 — Fail-closed market readiness reporting

## Objective

Prevent the operator-facing market evidence readiness report, and the action plan built on top of it, from silently accepting malformed or scope-incompatible evidence entries.

## Problem found on live `main`

`assessMarketReleaseEvidenceReadiness()` previously skipped non-object evidence entries, trimmed noncanonical ids, ignored evidence ids outside the selected release scope, and treated every status other than `VERIFIED` as if it were `PENDING`.

The authoritative `check:market-ready` gate remained stricter, but the readiness report could therefore present an incomplete or malformed manifest as an ordinary actionable plan instead of stopping the operator early.

## Delivery

KMD-303 makes readiness parsing fail closed before classification:

- every evidence entry must be an object;
- every evidence id must be non-empty and already canonical, without implicit trimming;
- every evidence id must belong to the selected `WEB_V1` or `FULL` scope;
- duplicate evidence ids are rejected immediately;
- status must be exactly `PENDING` or `VERIFIED`;
- missing required evidence remains a normal `MISSING` readiness state;
- verified evidence still requires a canonical, unexpired `validUntil` to count as ready.

Because `release:evidence:plan` reuses the same readiness engine, malformed manifests now fail closed in the planning workflow as well.

## Tests

The readiness suite covers complete and partial WEB_V1 manifests, FULL scope, missing/pending/expired/invalid-expiry states, duplicate ids, malformed entries, noncanonical ids, out-of-scope ids, invalid statuses, and malformed top-level inputs.

The existing root `pnpm test` command already includes `scripts/market-release-evidence-readiness-report.test.mjs` and the action-plan/contract suites, so CI exercises this change without adding a parallel test path.

## Migration

No Prisma migration and no user-data migration are required. Existing correctly initialized evidence manifests remain compatible. Operator-created manifests containing noncanonical, duplicate, out-of-scope, malformed, or unknown-status entries must be corrected rather than silently normalized.

## Rollback

Revert the KMD-303 commits. No database state, retained evidence bytes, signatures, receipts, deployment state, or user data are changed by this block.

## Proof boundary

This change only improves fail-closed parsing of readiness metadata. It does not authenticate evidence and does not prove production deployment, TLS/DNS, restore execution, monitoring/on-call, legal/privacy review, moderation/support drills, antimalware-provider behavior, physical-device validation, or store submission/publication. Those validations remain external or separately gated as defined by the market evidence contract.
