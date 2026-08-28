# KMD-298 — Market evidence readiness report

## Goal

Provide a deterministic operator-facing view of which market-release evidence items are still blocking a WEB_V1 or FULL release, without weakening or replacing the cryptographic `check:market-ready` gate.

## Delivery

- adds `pnpm release:evidence:status -- --file <manifest.json>`;
- reuses the canonical `requiredEvidenceForScope()` contract;
- classifies each required item as `VERIFIED`, `MISSING`, `PENDING`, `EXPIRED`, `INVALID_EXPIRY`, or `INVALID_DUPLICATE`;
- reports required, verified, and blocking counts;
- exits with code 2 when evidence is incomplete and code 1 when the input cannot be read or parsed;
- does not require signing keys and therefore cannot authenticate evidence or declare a release market-ready;
- adds unit coverage for WEB_V1, FULL, expiration, missing/pending items, duplicates, and malformed inputs.

## Migration

No Prisma or user-data migration is required. Operators may adopt the new read-only command immediately for draft or assembled manifests.

## Rollback

Revert KMD-298. Existing release evidence creation, semantic binders, signing, retained-bundle verification, and `check:market-ready` remain unchanged.

## Proof boundary

A report with `complete=true` means only that all required slots are present as `VERIFIED` and unexpired in the supplied JSON. It does not verify HMAC authenticity, SHA-256 provenance, retained bundle integrity, external facts, physical-device testing, legal review, production deployment, TLS/DNS, restore drills, monitoring/on-call, antimalware provider behavior, or store publication. `pnpm check:market-ready` remains the authoritative first-party gate.
