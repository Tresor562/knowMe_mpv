# KMD-287 — Production TLS/domain smoke

## Goal

Turn the existing `production_tls_domain` market-readiness requirement into an executable, fail-closed transport check instead of relying on a manually asserted HTTPS URL.

## Delivered

- `pnpm release:tls-domain:smoke` probes the exact production HTTPS origin.
- Node TLS certificate validation remains enabled (`rejectUnauthorized: true`) and the expected hostname is supplied as SNI.
- The smoke rejects HTTP, credentials, paths, query strings and fragments through the canonical production-origin parser.
- TLS timeout is bounded to 500–10,000 ms.
- Minimum remaining certificate validity is explicit and bounded to 1–365 days.
- The peer certificate must be currently valid and expose a canonical SHA-256 fingerprint.
- Optional `--output` writes a schema-v1 evidence artifact using exclusive creation and restrictive permissions where supported.
- Existing output files are never overwritten and are not deleted when exclusive creation fails.
- Root regression tests cover valid TLS, unauthorized/expired/near-expiry certificates, unsafe origins, non-canonical policy values and artifact overwrite safety.

## Operational usage

Example only after a production endpoint actually exists:

```bash
pnpm release:tls-domain:smoke \
  --url https://api.example.com \
  --min-validity-days 14 \
  --timeout-ms 5000 \
  --output evidence/production-tls-domain.json
```

The resulting artifact is a retained observation, not an automatic `VERIFIED` market-release item. A later semantic binder should validate this exact schema before promoting it to `production_tls_domain`.

## Migration

No Prisma or user-data migration is required. Release operators may adopt the new smoke alongside the existing deployment, metrics, restore-drill and antimalware validation tools.

## Rollback

Revert KMD-287. This removes the TLS/domain smoke command and its tests without changing runtime API behavior, database schema, user data or existing market-evidence contracts.

## Proof boundary

CI can validate parsing, TLS-policy logic and artifact safety with injected probes, but it does **not** prove the production domain, DNS records, public certificate chain, certificate renewal automation, CDN/load-balancer configuration, firewall/egress policy or real endpoint availability. `production_tls_domain` must remain unverified until the smoke is executed against the actual production origin and its retained artifact is reviewed/bound through the release-evidence workflow.
