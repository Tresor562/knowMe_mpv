# KMD-288 — Production TLS/domain evidence binding

## Goal

Prevent the generic market-evidence workflow from promoting an arbitrary hashed file to `production_tls_domain=VERIFIED` without validating that the retained artifact is the exact KMD-287 TLS/domain smoke contract.

## Delivered

- Adds `pnpm release:tls-domain:smoke:evidence:bind`.
- Parses the exact retained KMD-287 artifact bytes before hashing them.
- Requires schema v1, the expected kind, `PASSED`, canonical observation time, canonical HTTPS origin, matching hostname/port, bounded minimum-validity policy, exact TLS result fields, canonical SHA-256 certificate fingerprint, coherent certificate validity dates, and a bounded proof boundary.
- Recomputes remaining certificate lifetime from `validTo - observedAt` and requires it to match the retained value and satisfy `minValidityDays`.
- Derives `verifiedAt` from the validated smoke observation instead of accepting an independent operator timestamp.
- Creates only the canonical `production_tls_domain` evidence item and then relies on the existing unsigned-manifest → sign → bundle → receipt → `check:market-ready` workflow.
- Adds root regression coverage for unknown fields, hostname/port divergence, fingerprint/date inconsistencies, minimum-validity violations, future observations and malformed JSON.

## Operational usage

After KMD-287 has actually been executed against the real production origin and its artifact retained:

```bash
pnpm release:tls-domain:smoke:evidence:bind \
  --artifact evidence/production-tls-domain.json \
  --output evidence/production-tls-domain.item.json \
  --scope WEB_V1 \
  --verifier release-operator \
  --ref evidence://production-tls-domain/2026-08-27 \
  --valid-until 2026-09-27T14:00:00.000Z
```

The produced item still has to be applied to the unsigned market-release manifest, signed, bundled, retained and validated by `pnpm check:market-ready`.

## Migration

No Prisma or user-data migration is required. This is a release-evidence tooling addition only.

## Rollback

Revert KMD-288. Operators may temporarily fall back to the generic evidence-item creator, but that loses TLS-artifact semantic validation and therefore should not be considered equivalent for a market release.

## Proof boundary

CI validates parser, contract and binding behavior using synthetic artifacts. It does not prove production DNS, the public trust chain, the certificate currently served by the real endpoint, automatic renewal, CDN/load-balancer/firewall configuration, or endpoint reachability. `production_tls_domain` must only become VERIFIED from an artifact actually produced against the target production origin.
