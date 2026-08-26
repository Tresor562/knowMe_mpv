# KMD-268 — Generic market release evidence item apply

## Goal

Extend the deterministic evidence-application workflow introduced by KMD-267 from the single `production_deployment_smoke` slot to every evidence item required by the current market-release manifest scope, without weakening the signed release gate.

## Delivered

- Generalizes `pnpm release:evidence:item:apply` so it can apply any evidence ID required by the target manifest scope.
- Uses the canonical `requiredEvidenceForScope()` contract from the market-readiness validator instead of duplicating the allowlist.
- Preserves the KMD-267 compatibility wrapper for `production_deployment_smoke`.
- Requires schema v4, exact candidate commit/version binding, an unsigned manifest, exactly one matching slot, and a still-`PENDING` target slot.
- Accepts only the bounded evidence item shape and a `VERIFIED` item with canonical timestamps and lowercase SHA-256 digest.
- Rejects WEB_V1 attempts to inject FULL-only mobile/store evidence.
- Rejects unknown IDs, duplicate target slots, stale validity, future verification timestamps, signed manifests, and replacement of already-verified slots.
- Never mutates the input manifest and leaves the generated manifest unsigned so `release:evidence:sign` and `check:market-ready` remain mandatory.

## Tests

The root-gated suite now covers:

- common WEB_V1 evidence application;
- FULL-only evidence scope enforcement;
- KMD-267 smoke compatibility;
- signed-manifest refusal;
- exact commit/version binding;
- unknown IDs and extra fields;
- stale evidence;
- duplicate slots;
- refusal to overwrite an already verified slot.

## Migration

No Prisma migration is required. Release operations can keep the same command and use it for the remaining externally verified evidence items as those proofs become available.

## Rollback

Revert KMD-268. KMD-267 remains available for the production smoke slot, and other evidence items can return to the prior manual insertion process before signing.

## Proof boundary

KMD-268 does not create evidence, decide whether external evidence is truthful, sign a manifest, or mark KnowMe market-ready. It only makes insertion deterministic after an external proof has already been produced and represented as a bounded evidence item. Production deployment, TLS/DNS, restore drills, external monitoring/on-call, privacy/legal approval, data export/delete validation, moderation/support operations, antimalware production validation, physical mobile validation, and store submission remain external proof obligations.
