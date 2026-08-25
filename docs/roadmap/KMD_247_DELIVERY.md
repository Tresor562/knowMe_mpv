# KMD-247 — Media purge alert release preflight

## Goal

Prevent a market release from silently shipping the KMD-246 media purge alert worker without a usable, dedicated webhook configuration.

## Delivered

- Adds `scripts/media-purge-alert-release-preflight.mjs`.
- Requires `MEDIA_PURGE_ALERT_WEBHOOK_URL`, `MEDIA_PURGE_ALERT_WEBHOOK_TOKEN`, and `MEDIA_PURGE_ALERT_WEBHOOK_TIMEOUT_MS` for `pnpm check:release`.
- Requires HTTPS and rejects credentials, query strings, and fragments in the webhook URL.
- Requires a dedicated webhook token of at least 32 characters with no surrounding whitespace.
- Rejects reuse of the alert token with major existing KnowMe secret boundaries, including JWT, media scanner, storage, backup, account recovery, TURN, Nexus, stickers, and payment secrets.
- Requires a canonical timeout between 500 ms and 10 seconds.
- Adds regression coverage and wires it into the root `pnpm test` gate.

## Safety and privacy boundaries

This preflight validates configuration shape only. It does not send an alert and does not include any user, media, filename, storage key, hash, scanner response, or credential in diagnostics.

The KMD-245/KMD-246 aggregate-only alert payload remains unchanged.

## Operational proof boundary

A passing preflight does **not** prove:

- DNS resolution or certificate validity in the target environment;
- egress/firewall permission;
- webhook provider ownership or SLA;
- secret-manager injection;
- actual on-call delivery or escalation;
- distributed deduplication;
- successful end-to-end alert delivery.

Those checks require real target infrastructure and must remain release evidence outside this code-only gate.

## Migration

No Prisma migration is required. Before a market release, provision a dedicated HTTPS webhook endpoint and dedicated token, choose a timeout in the supported range, and inject the three server-only environment variables through the production secret/configuration system.

## Rollback

Revert KMD-247 to remove this release preflight. KMD-245 and KMD-246 remain intact, but a release could then start with alert delivery skipped because configuration is absent; that rollback should therefore be treated as a reduction in operational assurance.

## Validation

The exact PR head must pass dependency audit, Prisma generation/migrations/drift checks, build, unit/root tests, Chromium E2E, and PostgreSQL API E2E before merge.
