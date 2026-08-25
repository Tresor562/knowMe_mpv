# KMD-226 — HTTP server timeout hardening

## Goal

Make the Node HTTP server's connection/request timing boundaries explicit and fail-closed for a market release instead of depending on runtime defaults that may change across Node versions or be unsuitable for the deployed ingress topology.

## Changes

- Adds a bounded runtime policy for `requestTimeout`, `headersTimeout` and `keepAliveTimeout`.
- Applies the policy to the underlying Node HTTP server before `listen()`.
- Requires all three values explicitly when `NODE_ENV=production`.
- Keeps bounded development/test defaults so local workflows remain usable.
- Rejects non-canonical integer representations and unsafe relationships between timeout values.
- Adds a matching release preflight wired into both `pnpm check:release` and root `pnpm test`.
- Documents the three variables in `.env.example`.

## Bounds and invariants

- `API_REQUEST_TIMEOUT_MS`: 5,000..120,000 ms.
- `API_HEADERS_TIMEOUT_MS`: 1,000..60,000 ms and must be less than or equal to the total request timeout.
- `API_KEEP_ALIVE_TIMEOUT_MS`: 1,000..30,000 ms and must be lower than the total request timeout.

The repository deliberately does not prescribe one universal production value. Upload sizes, mobile latency, ingress behavior and real load tests must inform the final target-environment settings.

## Security and reliability rationale

Leaving server timeouts implicit can make slow or stalled connections consume resources for longer than intended and can cause different Node releases or environments to behave differently. KMD-226 makes the application-side boundary reviewable, testable and release-gated.

These settings are defense in depth only. They do not replace reverse-proxy timeouts, connection limits, WAF/DDoS controls, load testing, autoscaling or network-level protections.

## Tests

Unit coverage verifies:

- bounded non-production defaults;
- required production values;
- canonical integer parsing;
- lower/upper bounds;
- header/request and keep-alive/request ordering invariants;
- application of the resolved values to a Node HTTP-server-shaped object.

The standalone release-preflight suite verifies the same production invariants and is executed by root `pnpm test`.

## Migration

No Prisma migration and no persisted user-data change.

Before a market release, operations must choose all three timeout values based on the real ingress topology, expected request sizes and measured latency. `pnpm check:release` must be run with the same environment values used by the deployed API.

## Rollback

Revert KMD-226 and remove the three release variables. Node defaults would again become authoritative. Do not use rollback as a substitute for investigating timeout-related production incidents; if the chosen values are too strict, prefer a reviewed adjustment with load/latency evidence.

## Deliberate boundary

KMD-226 does not prove reverse-proxy timeout alignment, WAF/DDoS protection, real slow-client behavior, mobile-network performance, maximum supported upload duration, or production load characteristics. Those remain target-environment validations and must not be claimed without evidence.

## Merge gate

Merge only after the exact PR head passes the repository CI gate: production dependency audit, Prisma generation, migration deploy, zero drift, complete monorepo build, root tests including KMD-226, Chromium Web E2E and PostgreSQL API E2E.
