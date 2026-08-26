# KMD-267 — Market release evidence item apply workflow

## Goal

Remove the remaining manual copy/paste step between the KMD-266 `production_deployment_smoke` evidence item and the unsigned market-release evidence manifest without weakening the signed release gate.

## Delivered

- Adds `pnpm release:evidence:item:apply`.
- Accepts only the bounded `production_deployment_smoke` evidence item produced by KMD-266.
- Requires the target manifest to be schema v4, tied to the exact candidate commit/version, and still unsigned.
- Requires exactly one existing `production_deployment_smoke` slot and requires that slot to remain `PENDING` before replacement.
- Rejects extra item fields, stale validity, future verification timestamps, non-canonical SHA-256 digests, wrong IDs, and commit/version mismatches.
- Never mutates the source manifest in place and refuses to overwrite the output file.
- Leaves the resulting manifest intentionally unsigned so `release:evidence:sign` and `check:market-ready` remain mandatory.

## Usage

```sh
KNOWME_RELEASE_COMMIT='<exact-40-char-sha>' \
KNOWME_RELEASE_VERSION='1.0.0-rc.1' \
pnpm release:evidence:item:apply -- \
  --manifest ./release-evidence/market-evidence-unsigned.json \
  --item ./release-evidence/production-deployment-smoke-item.json \
  --output ./release-evidence/market-evidence-with-smoke.json
```

Then sign the complete manifest with the existing controlled signing workflow and run `pnpm check:market-ready` against that signed artifact.

## Tests

The KMD-267 suite covers:

- exact replacement of only the pending production smoke slot;
- source immutability;
- refusal to modify a signed manifest;
- commit/version binding;
- strict item shape and ID;
- stale validity rejection;
- refusal to replace an already verified slot.

The suite is wired into the root `pnpm test` gate.

## Migration

No Prisma migration is required. Release operations may adopt this command for the next candidate without changing application or user data.

## Rollback

Revert KMD-267. KMD-266 continues to generate a bounded evidence item and operators may return to the previous manual insertion step before signing.

## Proof boundary

KMD-267 only makes insertion of one already-generated smoke evidence item deterministic. It does not create, verify, sign, or approve any other release evidence. It does not prove production deployment, TLS/DNS ownership, restore drills, external monitoring/on-call, legal/privacy approval, antimalware-provider validation, physical mobile validation, or store publication.
