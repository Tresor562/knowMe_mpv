# KMD-278 — Antimalware provider production smoke evidence

## Goal

Turn the existing external media-scanner integration into a reproducible operational validation step for the `antimalware_provider_validation` market-release evidence slot without claiming that CI itself contacted a production provider.

## Delivered

- `pnpm release:antimalware:smoke -- --output <artifact.json>`;
- canonical production scanner configuration validation using the existing `MEDIA_SCANNER_URL`, `MEDIA_SCANNER_TOKEN`, and `MEDIA_SCANNER_TIMEOUT_MS` contract;
- one benign sample that must be classified `CLEAN`;
- one EICAR antivirus test sample that must be classified `INFECTED`;
- request SHA-256 and MIME headers matching the KnowMe scanner adapter contract;
- redirects refused and provider responses bounded to 4 KiB;
- provider response contract restricted to `verdict` + bounded `reference`;
- sanitized evidence artifact containing only hashes, expected verdicts, observation time, and the explicit proof boundary;
- scanner token, endpoint URL, and raw provider references are never persisted in the artifact;
- exclusive `wx` output creation with restrictive permissions where supported;
- root regression tests for success, false-clean/false-infected outcomes, unsafe configuration, malformed/oversized responses, secrecy, and overwrite protection.

## Operational use

Run this only from an approved production validation environment whose `MEDIA_SCANNER_*` values point to the real production antimalware provider:

```bash
pnpm release:antimalware:smoke -- --output evidence/antimalware-provider-smoke.json
```

If and only if the real command succeeds, retain the exact artifact bytes and their printed SHA-256. The existing generic release-evidence tooling can then build the `antimalware_provider_validation` evidence item from that retained artifact. Do not mark the evidence slot `VERIFIED` from unit tests or CI mocks.

## Security and privacy boundaries

- EICAR is a non-malicious antivirus test pattern, not executable malware.
- The scanner token remains process-only and is never emitted to the artifact.
- The scanner endpoint is represented only by SHA-256 in the artifact.
- Provider references are represented only by SHA-256.
- The artifact proves two point-in-time classifications only. It does not prove continuous availability, provider SLA, network egress policy, DNS/TLS ownership, secret-manager deployment, alert routing, quarantine analyst workflow, or future scanner behavior.

## Migration

No Prisma or user-data migration is required. Operators gain a new optional evidence-generation command. Existing scanner runtime behavior is unchanged.

## Rollback

Revert KMD-278. The external scanner runtime and the KMD-228 market blocker remain unchanged; antimalware production validation returns to a fully manual external-evidence process.

## Release boundary

KMD-278 must not remove or automatically satisfy the existing market-release requirement. A real production invocation and retained artifact are still required before `antimalware_provider_validation` can truthfully become `VERIFIED`.
