# KMD-249 — Media purge alert runtime configuration guard

## Goal

Make the production API fail closed at startup when the KMD-245/KMD-246 media purge alert delivery configuration is absent or unsafe, so runtime behavior cannot silently diverge from the KMD-247 release preflight.

## Delivered

- `MediaPurgeAlertService` now implements `OnModuleInit`.
- Production startup requires a valid `MEDIA_PURGE_ALERT_WEBHOOK_URL`, `MEDIA_PURGE_ALERT_WEBHOOK_TOKEN`, and `MEDIA_PURGE_ALERT_WEBHOOK_TIMEOUT_MS`.
- The runtime guard reuses the exact adapter validation rules already used for delivery: HTTPS only, no URL credentials/query/fragment, token length >= 32, and canonical timeout in the existing 500–10000 ms range.
- Development and test environments keep the existing optional configuration behavior.
- Delivery behavior and payload privacy boundaries are unchanged.
- Unit coverage verifies valid production startup, missing configuration, unsafe configuration, non-production behavior, and the existing delivery paths.

## Migration

No Prisma migration is required and no user data is modified.

Operational migration for production environments:

1. Provision the webhook endpoint and dedicated token in the target secret/configuration system.
2. Set all three `MEDIA_PURGE_ALERT_WEBHOOK_*` values before starting the API.
3. Run the repository release preflight and CI gates.
4. Start the API only after the configuration has been injected.

A production process with missing or invalid alert configuration will now refuse to initialize.

## Rollback

Revert KMD-249 to restore the previous behavior where invalid or absent runtime configuration caused alert delivery to return `SKIPPED_NOT_CONFIGURED` instead of blocking production startup. Do not use that rollback to claim release readiness; KMD-247 still requires the configuration at release preflight.

## Proof boundaries

This change proves only repository-level runtime configuration enforcement. It does not prove webhook-provider ownership or SLA, DNS/TLS/egress, secret-manager delivery, real incident delivery/escalation, distributed multi-instance deduplication/state, antimalware provider readiness, legal approval, deployment, physical mobile validation, or store publication.
