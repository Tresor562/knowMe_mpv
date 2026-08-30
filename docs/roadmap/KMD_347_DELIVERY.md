# KMD-347 — Machine-checkable KMD delivery registry integrity

## Problem

The historical `docs/roadmap/DELIVERY_LEDGER.md` is stale relative to live GitHub and still describes KMD-061 as pending even though the canonical repository has progressed far beyond that point. Relying on that document alone can cause a future contributor to reuse an already delivered KMD identifier or misread the current delivery boundary.

Live GitHub remains authoritative, but the repository also needs a local integrity check over its canonical `KMD_###_DELIVERY.md` records so that duplicate/mismatched delivery identities are detectable in CI.

## Delivery

- Add `scripts/kmd-delivery-registry-preflight.mjs`.
- Enumerate only canonical delivery files matching `docs/roadmap/KMD_###_DELIVERY.md`.
- Require every canonical filename to start with the matching `# KMD-###` heading.
- Reject duplicate canonical delivery identifiers.
- Report the highest documented KMD identifier without claiming that documentation alone proves merge status.
- Keep GitHub `main`, merged PR history and exact CI evidence as the authority for whether a milestone is actually finished.
- Include the registry regression suite in the existing root test execution through the governance test entrypoint so CI exercises it without weakening any existing test step.

## Tests

The new tests cover:

1. canonical filenames with matching headings;
2. fail-closed behavior when a delivery file reuses/mismatches another KMD heading;
3. ignoring non-canonical notes/aliases so historical notes cannot reserve a canonical KMD accidentally.

The root `pnpm test` suite executes these tests through `github-release-governance-preflight.test.mjs`.

## Migration

No Prisma migration, user-data migration, API migration or release-evidence schema migration is required.

## Rollback

Revert the KMD-347 commits. No application data rollback is required. Reverting removes the local registry-integrity guard and reopens the risk that a mismatched canonical delivery document can land unnoticed.

## Operational boundary

This guard does not infer merge status from filenames and does not override live GitHub. A delivery document can exist on a feature branch before merge; therefore merge completion must still be proven by the canonical GitHub history and required CI/review gates.

## Proof boundary

KMD-347 proves only structural integrity of canonical KMD delivery-document identities. It does not prove physical-device validation, legal review, production deployment, restore success, monitoring delivery, branch protection configuration or app-store publication.
