# KMD-296 — Privacy/terms legal-review artifact builder

## Goal

Produce the strict schema-v1 artifact consumed by KMD-294 from exact retained production privacy-policy, terms, consent-notice, and legal-review-record bytes, instead of allowing an operator to hand-enter their SHA-256 digests.

## Delivered

- `pnpm release:privacy-legal:artifact`.
- Exact schema-v1 legal-review record validation for six required checks:
  - privacy policy review;
  - terms review;
  - consent review;
  - data lifecycle review;
  - minors/age-gate review;
  - processor/subprocessor review.
- Every check must be `PASSED`, contain a canonical UTC completion timestamp, and complete no later than the retained observation.
- Exact SHA-256 binding of the retained privacy policy, terms, consent notice, and legal-review record bytes.
- Regular-file/non-symlink requirement with a bounded 2 MiB input size per retained source file.
- Explicit confirmation `PRIVACY_LEGAL_REVIEW_COMPLETED` before artifact creation.
- Exclusive artifact creation (`wx`), restrictive permissions where supported, `fsync`, cleanup only for files created by the current invocation, and preservation of any pre-existing artifact.
- Root regression coverage.

## Usage

```bash
pnpm release:privacy-legal:artifact \
  --privacy-policy ./evidence/privacy-policy.md \
  --terms ./evidence/terms.md \
  --consent-notice ./evidence/consent-notice.md \
  --legal-review-record ./evidence/privacy-legal-review-record.json \
  --output ./evidence/privacy-legal-review.json \
  --confirm PRIVACY_LEGAL_REVIEW_COMPLETED
```

The legal review record must use the exact contract:

```json
{
  "schemaVersion": 1,
  "kind": "knowme-privacy-terms-legal-review-record",
  "environment": "PRODUCTION",
  "status": "PASSED",
  "observedAt": "2026-08-28T00:25:00.000Z",
  "checks": {
    "privacyPolicyReview": { "status": "PASSED", "completedAt": "2026-08-28T00:20:00.000Z" },
    "termsReview": { "status": "PASSED", "completedAt": "2026-08-28T00:20:00.000Z" },
    "consentReview": { "status": "PASSED", "completedAt": "2026-08-28T00:20:00.000Z" },
    "dataLifecycleReview": { "status": "PASSED", "completedAt": "2026-08-28T00:20:00.000Z" },
    "minorsAgeGateReview": { "status": "PASSED", "completedAt": "2026-08-28T00:20:00.000Z" },
    "processorSubprocessorReview": { "status": "PASSED", "completedAt": "2026-08-28T00:20:00.000Z" }
  }
}
```

After retaining the generated artifact, KMD-294 remains the semantic market-evidence binder:

```bash
pnpm release:privacy-legal:evidence:bind ...
```

## Migration

No Prisma or user-data migration is required. Release operators should retain the exact production privacy policy, terms, consent notice, and accountable legal-review record, create the KMD-296 artifact, then bind that artifact with KMD-294.

## Rollback

Revert KMD-296. KMD-294 remains available and can still validate an independently produced artifact matching its strict schema-v1 contract.

## Proof boundary

KMD-296 proves only byte binding and structural/timestamp consistency of retained materials and the recorded review. It does **not** establish legal compliance, regulatory approval, adequacy for every jurisdiction, or continuing validity after changes in product behavior, processors, policy, or law.

Synthetic CI fixtures must never be used as production legal evidence. A market release still requires accountable review by the appropriate privacy/legal owner and retention of the actual reviewed production materials.
