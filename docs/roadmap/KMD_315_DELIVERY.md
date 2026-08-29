# KMD-315 — Mandatory manual evidence ingestion authorization

## Goal

Close the direct lower-level bypass left after KMD-314. The four FULL manual evidence ids (iOS physical validation, Android physical validation, App Store submission, Google Play submission) must not be applied merely because a serialized JSON item is well formed and release-bound.

## Enforcement

`applyMarketReleaseEvidenceItem(...)` now requires a `manualAuthorization` for those four ids. The authorization must be the exact process-local object minted by a successful KMD-313/KMD-314 reviewed-promotion preflight and must still match the exact evidence item, target commit and target version.

A hand-built object, shallow copy, authorization for another item, or authorization for another release fails closed.

`applyMarketReleaseEvidenceBatch(...)` accepts a `manualAuthorizations` `Map` keyed by evidence id and forwards only the matching authorization to the item-level gate. `finalizeMarketReleaseEvidence(...)` forwards the same map into batch apply before any signing operation. Therefore direct item apply, batch apply and finalization all share the same process-local authorization requirement.

The single-item CLI now accepts `--artifact`, `--worksheet` and `--review-receipt` for manual physical/store evidence. It reruns the reviewed promotion preflight from the retained bytes in the same process and passes the resulting authorization directly into apply. Nothing serializes or persists the authorization as a trusted credential.

## Current operator boundary

Batch/finalize library callers can supply authorizations minted in the same process. Their existing CLIs intentionally fail closed for FULL manual evidence until a follow-up operator-flow block adds an explicit retained-chain loader for each manual id. This is safer than accepting serialized lookalike authorizations or silently keeping the old bypass.

WEB_V1/common evidence behavior is unchanged.

## Tests

- common WEB_V1 item apply remains accepted;
- manual item apply without authorization is rejected;
- forged/shallow-copied authorization is rejected;
- authorization reuse after item drift is rejected;
- exact reviewed authorization succeeds at item apply and transport-only release fields remain stripped before manifest persistence;
- FULL batch/finalize reject absent and forged authorization maps before mutation/signing;
- legacy manual evidence without release binding remains rejected before mutation or signing.

All modified suites remain part of the repository root `pnpm test` gate.

### CI regression found and corrected

CI run #1106 on head `522cbbacab10ff928d2c16a87824b12eff55a55d` passed dependency installation, production dependency audit, Prisma generation, migration deployment/drift verification and the full monorepo build. Package-level tests also passed, including all 97 API suites / 498 API tests.

The root script suite then reported exactly two failures: the legacy FULL batch and finalize tests still expected the older KMD-311 `releaseCommit`/`releaseVersion` rejection. KMD-315 correctly rejects those same unauthenticated manual items earlier at the stronger reviewed-promotion authorization gate. The runtime security check was therefore preserved; only the stale assertions were updated to require the new authorization failure and to verify that the source manifest remains unmodified. Web Playwright and API E2E were skipped by that failed run and must pass on the replacement head before merge.

## Migration

No Prisma migration, user-data migration, product API migration or market-manifest schema migration is required. The authorization is process-local only and is never written into the signed manifest.

## Rollback

Revert the KMD-315 apply/batch/finalize authorization plumbing and its tests/documentation as one unit. Do not partially revert only the item-level validator while leaving callers assuming the stronger contract.

## Proof boundary

KMD-315 proves only that KnowMe's software pipeline requires the reviewed retained-evidence chain before manual FULL evidence can enter the manifest. It does not prove that a physical iOS/Android test or an App Store/Google Play submission actually occurred. Those remain external validations requiring real retained proof and accountable human review.
