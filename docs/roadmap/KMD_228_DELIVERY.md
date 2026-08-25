# KMD-228 — Production media scanner fail-closed boundary

## Goal

Remove the unsafe assumption that the built-in EICAR-only development signature check is sufficient to mark arbitrary production uploads as clean.

## Changes

- Keeps the existing local signature behavior for development and automated tests.
- In production, any upload that is not explicitly recognized as the EICAR test signature receives scanner verdict `UNAVAILABLE` and remains `QUARANTINED`.
- Adds a release preflight that deliberately blocks a market release until a real external production scanner is integrated and validated.
- Wires the blocker test into the root `pnpm test` suite.

## Security rationale

The previous scanner only recognized the EICAR test string and otherwise returned `CLEAN`. That is useful for deterministic development tests but is not a production malware scanner. Treating arbitrary user-controlled files as clean under that implementation would be an unsafe launch assumption.

KMD-228 therefore fails closed: production media cannot become `AVAILABLE` merely because the local test signature did not match.

## Product boundary

This milestone intentionally does **not** claim that production media upload is launch-ready. A follow-up must implement a real scanner adapter with authenticated transport, bounded timeout, strict response validation, fail-closed error handling, operational observability and target-environment validation before the release gate can be opened.

## Tests

Coverage proves that:

- non-production keeps the deterministic local-signature behavior;
- ordinary production media is marked `UNAVAILABLE` rather than `CLEAN`;
- EICAR remains classified as `INFECTED`;
- the market-release preflight remains blocked while no real production scanner exists.

## Migration

No Prisma migration and no persisted-user-data migration are required. Existing media rows are unchanged.

## Rollback

Reverting KMD-228 restores the former local-signature behavior. That rollback must not be used as justification for a market release because it would again allow arbitrary production media to be marked clean without a real scanner.

## External proof still required

KMD-228 does not prove or claim:

- a production malware-scanning provider;
- provider credentials or secret-manager configuration;
- network isolation or egress policy;
- scanner latency/throughput under load;
- supported file-format detection depth;
- quarantine operations or analyst review;
- real mobile upload behavior;
- production deployment.

## Merge gate

Merge only after the exact PR head passes dependency audit, Prisma generation, migration deploy, zero drift, full monorepo build, root tests including KMD-228, Chromium Web E2E and PostgreSQL API E2E.
