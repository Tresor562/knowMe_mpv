# KMD-290 — External monitoring evidence binding

## Goal

Bind a retained KMD-289 external monitoring/alerting smoke artifact to the market-readiness evidence slot `external_monitoring_alerting` only after semantically validating the retained artifact itself.

The generic evidence-item builder hashes arbitrary retained bytes but does not know whether those bytes represent a successful monitoring smoke. KMD-290 adds the semantic boundary before a `VERIFIED` market item can be produced for this requirement.

## Command

```bash
pnpm release:monitoring:smoke:evidence:bind \
  --artifact ./evidence/external-monitoring.json \
  --output ./evidence/external-monitoring-item.json \
  --scope WEB_V1 \
  --verifier release-operator \
  --ref evidence://monitoring/2026-08-27 \
  --valid-until 2026-09-03T17:55:00.000Z
```

## Semantic validation

The binder requires the exact KMD-289 schema-v1 artifact and verifies:

- `kind=knowme-external-monitoring-alerting-smoke`;
- `status=PASSED`;
- canonical, non-future `observedAt`;
- canonical HTTPS production origin;
- canonical SHA-256 hashes for the evidence endpoint and monitor identifier;
- bounded canonical provider name;
- monitor state exactly `UP`;
- alerting enabled and latest test exactly `DELIVERED`;
- canonical monitoring and alert timestamps;
- policy bounds retained in the artifact;
- monitor and alert timestamps remain within the exact retained freshness policy when recomputed relative to `observedAt`.

Unknown fields are rejected fail-closed.

## Evidence binding

After semantic validation, the binder reuses the canonical market evidence item builder to:

- force the evidence ID to `external_monitoring_alerting`;
- derive `verifiedAt` from the smoke's retained `observedAt` rather than operator input;
- compute `evidenceSha256` from the exact retained artifact bytes;
- preserve scope, verifier, reference, validity, URI and canonical metadata rules already enforced by the market-release evidence contract.

The output remains only an evidence item. It still must be applied to an unsigned manifest, finalized/signed, bundled, retained and pass `check:market-ready`.

## Tests

Root `pnpm test` includes KMD-290 regression coverage for:

- exact valid artifact and evidence-item creation;
- unknown fields;
- monitor not `UP`;
- alerting disabled or not delivered;
- stale monitor observation;
- stale alert test;
- invalid hashes/origin/provider metadata;
- future observation;
- malformed JSON.

## Migration

No Prisma migration and no user-data migration.

Operational adoption is additive: continue producing KMD-289 artifacts, then use the KMD-290 binder instead of the generic evidence-item builder for the `external_monitoring_alerting` slot.

## Rollback

Revert KMD-290. KMD-289 remains available and the generic evidence tooling remains unchanged. Existing signed bundles and runtime state are unaffected.

## Proof boundary

KMD-290 proves that the retained artifact has the exact expected KMD-289 semantics and that its exact bytes are bound to the market evidence item. It does not prove that the external provider is truthful, that production DNS/TLS/egress is correct, that alert escalation reached a human on-call destination, or that the provider meets retention/SLA requirements. Those facts still require a real production execution and independently retained evidence.
