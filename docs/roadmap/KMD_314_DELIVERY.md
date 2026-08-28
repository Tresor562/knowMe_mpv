# KMD-314 — Manual promotion authorization primitive

## Goal

Prepare mandatory enforcement of KMD-313 reviewed manual evidence promotion at the lower-level ingestion APIs without weakening or faking external device/store validation.

KMD-313 proves that a serialized FULL manual evidence item still matches the exact reviewed worksheet, human-review receipt, retained proof bytes, and target release. KMD-314 adds a process-local authorization primitive that can only be minted by a successful KMD-313 preflight.

## Contract

A successful `preflightManualReleaseEvidencePromotion(...)` now returns an opaque frozen authorization object in addition to `ok: true`.

The authorization is registered in a module-private `WeakSet`. `validateManualReleaseEvidencePromotionAuthorization(...)` accepts it only when:

- the object identity was actually minted by the successful preflight in the current process;
- the evidence id matches;
- the target release commit matches;
- the target release version matches;
- the complete serialized evidence item is unchanged.

A caller cannot satisfy the validator by reconstructing or shallow-copying the visible authorization fields. This gives the next ingestion block a non-forgeable in-process proof that the reviewed chain was actually revalidated immediately before apply/batch/finalize.

## Security boundary

This KMD deliberately does **not** yet change `applyMarketReleaseEvidenceItem`, batch apply, or finalize. Therefore it does not claim that direct lower-level ingestion is already impossible without the promotion preflight.

The next block must thread these authorizations through apply, batch and finalize, including CLI loading of the retained proof, worksheet and review receipt, and must fail closed for every one of the four FULL manual ids when no valid authorization is supplied.

The process-local authorization is not a substitute for retained evidence and is intentionally not serializable as a trusted credential. Restarting the process requires rerunning the KMD-313 preflight from the real retained artifacts.

Passing either the preflight or authorization validation does **not** certify that an iOS/Android physical test or App Store/Google Play submission actually occurred. Those remain external validations requiring real-world retained proof.

## Tests

The existing KMD-313 test suite now also proves:

- successful preflight mints a frozen authorization;
- a hand-built lookalike authorization is rejected;
- a shallow copy is rejected;
- item drift is rejected;
- release-commit drift is rejected.

The suite remains part of the root `pnpm test` gate.

## Migration

No Prisma migration, user-data migration, API schema migration, manifest schema migration, or product-data rewrite is required.

## Rollback

Rollback consists of reverting the authorization mint/validator and the additional tests/documentation. KMD-313 preflight behavior and all existing evidence artifacts remain valid.
