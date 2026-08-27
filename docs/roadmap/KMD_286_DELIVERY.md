# KMD-286 — Antimalware provider smoke market-evidence binding

## Goal

Prevent a merely hashable or hand-authored JSON file from being promoted to the market-release `antimalware_provider_validation` evidence slot without validating the semantics of the KMD-278 antimalware provider smoke artifact.

## Delivered behavior

`pnpm release:antimalware:smoke:evidence:bind` reads the exact retained KMD-278 artifact bytes and validates the smoke contract before producing a `VERIFIED` market-evidence item.

The binder requires:

- exact antimalware smoke schema v1 fields;
- `kind=knowme-antimalware-provider-smoke`;
- canonical, non-future `observedAt`;
- canonical SHA-256 of the scanner endpoint identity;
- the exact KnowMe benign validation sample SHA-256 with verdict `CLEAN`;
- the exact EICAR validation sample SHA-256 with verdict `INFECTED`;
- canonical hashed provider references only;
- a bounded, control-character-free proof boundary.

Only after these semantic checks pass does the binder reuse the canonical market-evidence item creator. The resulting item:

- has id `antimalware_provider_validation`;
- derives `verifiedAt` from the retained smoke artifact rather than operator input;
- hashes the exact artifact bytes retained by release operations;
- still requires an explicit `validUntil`, verifier and canonical evidence reference;
- remains only one input to the unsigned release manifest.

It must still be applied, signed, bundled, retained and pass `check:market-ready` together with every other proof required by the selected release scope.

## Tests

The root `pnpm test` suite includes `scripts/antimalware-provider-smoke-evidence-binding.test.mjs`, covering:

- canonical passing artifact and exact-byte SHA-256 binding;
- unknown top-level and nested fields;
- wrong benign sample or verdict;
- wrong EICAR sample or verdict;
- malformed endpoint/provider-reference hashes;
- invalid JSON;
- future observation timestamps;
- invalid proof-boundary metadata without leaking provider details in validation errors.

## Migration

No Prisma or user-data migration is required.

Release operators should use the specialized antimalware binder for `antimalware_provider_validation` rather than the generic evidence-item creator whenever the proof source is the KMD-278 provider smoke artifact.

## Rollback

Revert KMD-286. The generic KMD-269 evidence-item creator remains available, but semantic validation of antimalware smoke artifacts would again become a manual release-review responsibility.

## Proof boundary

KMD-286 validates the structure and internally recorded result of a retained KMD-278 smoke artifact. It does not prove that CI contacted a production scanner, that the scanner endpoint is owned or operated by the intended provider, that credentials are production credentials, that DNS/TLS/egress policies are correct, that the provider will remain available, or that incident/on-call procedures exist.

A real market proof still requires executing KMD-278 against the actual production antimalware provider, retaining the exact artifact, independently reviewing the execution context, binding those exact bytes with KMD-286, and preserving the resulting item in the signed market-release evidence bundle.
