# KMD-289 — External monitoring and alerting smoke

## Goal

Turn the `external_monitoring_alerting` market-readiness requirement into a live, provider-neutral smoke that can be executed against an external monitoring system or a narrow monitoring-evidence bridge.

KMD-289 does **not** mark the market evidence slot as verified by itself. CI only exercises synthetic provider responses. A production operator must still run the smoke against the real external monitoring system, retain the generated artifact, and bind it into the signed market-evidence workflow in a later step.

## Command

```bash
pnpm release:monitoring:smoke \
  --evidence-url "$KNOWME_EXTERNAL_MONITORING_EVIDENCE_URL" \
  --production-origin "$KNOWME_PRODUCTION_BASE_URL" \
  --output ./evidence/external-monitoring.json
```

Server-only token:

```bash
KNOWME_EXTERNAL_MONITORING_EVIDENCE_TOKEN=...
```

Optional bounded policy:

```bash
KNOWME_EXTERNAL_MONITORING_TIMEOUT_MS=5000
KNOWME_EXTERNAL_MONITORING_MAX_OBSERVATION_AGE_SECONDS=900
KNOWME_EXTERNAL_MONITORING_MAX_ALERT_TEST_AGE_HOURS=24
```

Allowed bounds:

- timeout: 500..10000 ms;
- monitor observation age: 60..3600 seconds;
- last alert delivery test age: 1..168 hours.

## External attestation contract

The HTTPS evidence endpoint must return exactly:

```json
{
  "schemaVersion": 1,
  "kind": "knowme-external-monitoring-alerting-attestation",
  "productionOrigin": "https://knowme.example/",
  "status": "PASSING",
  "monitoring": {
    "state": "UP",
    "lastCheckedAt": "2026-08-27T16:00:00.000Z"
  },
  "alerting": {
    "enabled": true,
    "lastTestAt": "2026-08-27T12:00:00.000Z",
    "lastTestStatus": "DELIVERED"
  },
  "provider": {
    "name": "Provider name",
    "monitorIdHash": "<lowercase sha256>"
  }
}
```

Unknown fields are rejected. The production origin must match the exact release target. Monitor state must be `UP`; alerting must be enabled; the last alert test must have been delivered and remain within the configured freshness window.

## Network and secret boundary

- evidence endpoint must use HTTPS;
- credentials, query strings and fragments in the configured URL are refused;
- token must be canonical and at least 32 characters;
- redirects are refused;
- response body is capped at 64 KiB;
- token is never written to the evidence artifact;
- the raw endpoint URL is not written to the artifact; only its SHA-256 is retained.

## Evidence artifact

A successful run can write a schema-v1 `knowme-external-monitoring-alerting-smoke` artifact containing only bounded facts:

- observation time;
- production origin;
- SHA-256 of the evidence endpoint URL;
- provider display name;
- hashed monitor identifier;
- latest monitor observation;
- latest delivered alert-test observation;
- freshness policy applied.

The output is created exclusively (`wx`) and with restrictive permissions when supported. An existing artifact is never overwritten. If this invocation created a partial output and then fails, only that partial output is cleaned up.

## Tests

Root `pnpm test` includes regression coverage for:

- valid external monitor + delivered alert test;
- unsafe URL forms;
- weak token;
- DOWN monitoring state;
- disabled alerting;
- stale monitor observation;
- stale alert-delivery test;
- wrong production origin;
- strict-schema rejection;
- invalid provider hash;
- non-JSON provider response;
- exclusive evidence writing and preservation of pre-existing artifacts.

## Migration

No Prisma migration and no user-data migration.

Operational adoption requires a real external monitoring system or a narrow bridge that can expose the attestation contract from the provider's authoritative state.

## Rollback

Revert KMD-289. This removes only the smoke command, tests and documentation. Runtime API, database state and existing market-evidence requirements remain unchanged.

## Proof boundary

A green CI run proves only parser, transport and policy behavior against synthetic responses. It does not prove that production monitoring exists, that a real alert reached an on-call destination, that escalation works, that the provider has adequate retention/SLA, or that DNS/TLS/network paths are correct in production. Those facts require a real production execution and retained external evidence.
