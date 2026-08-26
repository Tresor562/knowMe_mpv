# KMD-250 — Market release evidence contract

## Goal

Turn the external proof boundary introduced by KMD-161 and reinforced by later market-readiness KMDs into a machine-checked release evidence contract without pretending that repository automation can prove real infrastructure, legal, physical-device, or store validation.

## Delivered

- `scripts/market-release-evidence-preflight.mjs` validates a versioned JSON evidence manifest.
- Evidence is bound to an exact 40-character Git release commit.
- `WEB_V1` requires retained proof for production TLS/domain, production deployment smoke, backup/restore drill, external monitoring/alerting, privacy/terms/legal review, account export/delete validation, moderation/support/incident operations, and production antimalware validation.
- `FULL` additionally requires physical iOS/Android validation and App Store/Google Play submission evidence.
- Every required item must be explicitly `VERIFIED` with a canonical UTC timestamp, responsible verifier, and retained evidence reference.
- Missing, pending, duplicate, future-dated, malformed, or wrong-commit evidence fails closed.
- The example manifest is intentionally `PENDING`; it cannot pass the gate unchanged.
- `pnpm check:market-ready -- --file <manifest.json>` combines the existing machine-verifiable release configuration gate with this external-evidence completeness gate.

## Important proof boundary

This validator checks the structure and completeness of recorded evidence. It does **not** independently verify that an evidence reference is truthful, that a certificate is live, that a restore actually succeeded, that a lawyer approved documents, that a device was physically tested, or that a store accepted a build. Those claims still require real retained artifacts and human/operational accountability.

A `WEB_V1` scope intentionally does not require mobile/store evidence, so a commercially usable Web release can be evaluated independently. It does not waive any of the common security, privacy, recovery, moderation, observability, or antimalware evidence.

## Migration

No Prisma migration is required and no product data is modified.

For a release candidate:

1. Copy `docs/release/MARKET_RELEASE_EVIDENCE.example.json` outside public artifacts or to the controlled release-evidence location.
2. Set `releaseCommit` to the exact candidate commit.
3. Record real retained evidence only after each external validation is performed.
4. Keep incomplete items as `PENDING`; never mark them `VERIFIED` to satisfy the script.
5. Run the normal CI and `pnpm check:market-ready -- --file <manifest.json>` against the same candidate commit.

## Rollback

Revert KMD-250 to remove the evidence-contract command and tests. This does not remove any underlying market-readiness obligation documented since KMD-161 and does not make a release safe merely because the evidence gate is absent.
