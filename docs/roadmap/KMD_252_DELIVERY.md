# KMD-252 — Market release evidence expiry

## Goal

Prevent structurally valid but stale external release evidence from remaining acceptable indefinitely.

KMD-250 introduced the market evidence contract and KMD-251 bound it to the exact candidate commit. Before KMD-252, a `VERIFIED` evidence item could still pass forever as long as `verifiedAt` was canonical and not in the future.

## Delivery

- Every required `VERIFIED` evidence item now requires `validUntil`.
- `validUntil` must be a canonical ISO-8601 UTC timestamp.
- `validUntil` must be strictly later than `verifiedAt`.
- Evidence whose `validUntil` is at or before the current validation time fails closed and must be revalidated.
- The example market evidence manifest exposes the new field explicitly.
- Regression tests cover missing, malformed, expired and non-forward validity windows.

## Policy boundary

KMD-252 intentionally does **not** invent one universal validity duration for legal review, TLS, restore drills, monitoring, antimalware validation, store evidence or physical-device checks. Those validity periods depend on the actual release policy, provider, infrastructure and legal context.

The responsible reviewer/operator must set a defensible `validUntil` when retaining each proof. The checker only enforces that the declared validity window is explicit, canonical and still current.

## Migration

No Prisma migration and no product-data changes.

Existing candidate evidence manifests must add `validUntil` for each required evidence item before `pnpm check:market-ready` can pass. The checked-in example remains `PENDING`; it is documentation only and cannot prove a release.

## Rollback

Revert KMD-252. This would restore indefinite structural acceptance of old `VERIFIED` evidence and therefore weakens market-readiness guarantees. A rollback must not be used to claim a release ready.

## Proof boundary

KMD-252 proves only that each required evidence record declares an unexpired validation window at check time. It does not prove that the evidence is truthful, that the chosen validity period is legally or operationally appropriate, or that deployment, TLS, restore drills, monitoring/on-call, antimalware, physical devices or store submissions actually occurred.
