# KMD-266 — Production smoke evidence manifest binding

## Goal

Reduce release-operator error when transferring the KMD-265 production smoke artifact into the signed market-readiness evidence manifest.

## Delivered

- Adds `pnpm release:smoke:evidence:bind`.
- Reads the exact persisted KMD-265 artifact bytes and computes their SHA-256.
- Revalidates the artifact schema, both successful smoke checks, observation timestamp, release commit, and release version.
- Requires a canonical verifier identity, a credential-free `https:` or `evidence:` reference, and an explicit future `validUntil` timestamp.
- Emits only the bounded `production_deployment_smoke` evidence item expected by the market-readiness manifest.
- Writes output exclusively (`wx`) with restrictive permissions where supported so an existing evidence item cannot be silently overwritten.
- Never reads or stores `METRICS_BEARER_TOKEN` and never copies raw deployment/metrics responses.

## Usage

```sh
KNOWME_RELEASE_COMMIT='<exact-40-char-sha>' \
KNOWME_RELEASE_VERSION='1.0.0-rc.1' \
pnpm release:smoke:evidence:bind -- \
  --artifact ./release-evidence/production-smoke.json \
  --output ./release-evidence/production-deployment-smoke-item.json \
  --verifier release-operator \
  --evidence-ref evidence://release/production-smoke.json \
  --valid-until 2026-09-02T18:00:00.000Z
```

The generated item still has to be incorporated into the release evidence manifest and that complete manifest must be signed and pass `pnpm check:market-ready`.

## Tests

The KMD-266 suite covers:

- exact SHA-256 binding to the persisted artifact bytes;
- exact commit/version matching;
- both required smoke checks;
- canonical verifier and evidence reference handling;
- rejection of credential/query-bearing references;
- future/stale timestamp handling.

The suite is wired into the root `pnpm test` gate.

## Migration

No Prisma migration is required. Release operations may adopt the binding command for the next release candidate without modifying product data.

## Rollback

Revert KMD-266. KMD-265 smoke evidence generation remains available and operators can continue binding the resulting digest manually under the existing market evidence contract.

## Proof boundary

KMD-266 only makes the transfer from a valid KMD-265 smoke artifact into the `production_deployment_smoke` evidence item deterministic. It does not prove continuous monitoring, alert/on-call delivery, DNS ownership, backup restore drills, legal/privacy review, antimalware-provider validation, physical mobile validation, or store publication. It also does not independently establish that an evidence URI remains retained; release operations must preserve the referenced artifact and its SHA-256.
