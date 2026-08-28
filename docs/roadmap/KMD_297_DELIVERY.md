# KMD-297 — Semantic evidence binder enforcement

## Goal

Prevent KnowMe's operator-facing generic market-evidence command from creating `VERIFIED` items for market criteria that already have dedicated semantic binders.

The generic item constructor introduced earlier is still required internally by dedicated binders after they validate a retained artifact's schema and semantics. The operator-facing generic command must not provide an easier path that skips those checks.

## Scope

The following common market criteria now require their dedicated semantic evidence binders in first-party release tooling:

- `production_tls_domain`
- `production_deployment_smoke`
- `backup_restore_drill`
- `external_monitoring_alerting`
- `privacy_terms_legal_review`
- `data_export_delete_validation`
- `moderation_support_incident_ops`
- `antimalware_provider_validation`

`pnpm release:evidence:item:create` remains available only for the FULL-scope evidence that is inherently external/manual and still requires real-world proof:

- `ios_physical_validation`
- `android_physical_validation`
- `ios_store_submission`
- `android_store_submission`

This does not claim that those physical/store validations have been performed. It only preserves a bounded byte-hashing path for externally retained artifacts after those validations really occur.

## Implementation

- Keeps `createMarketReleaseEvidenceItem()` as the low-level constructor used by semantic binder modules after their own validation succeeds.
- Adds `createGenericMarketReleaseEvidenceItem()` as the only generic operator-facing path.
- Routes the `release:evidence:item:create` CLI through the generic wrapper.
- Fails closed if a common market criterion with a dedicated semantic binder is supplied to the generic command.
- Requires `scope=FULL` for generic external evidence.
- Adds regression tests covering every semantically bound common criterion and every remaining FULL-only generic criterion.

## Migration

No Prisma migration, persistent-data migration, API contract change, or user-data rewrite is required.

Release operators must stop using `release:evidence:item:create` for common WEB_V1/FULL criteria and use the existing dedicated commands instead, such as TLS/domain smoke binding, deployment smoke binding, restore-drill binding, monitoring binding, privacy/legal binding, data-lifecycle binding, moderation-ops binding, and antimalware binding.

## Rollback

Revert KMD-297. This restores the previous generic CLI behavior, but also restores the accidental first-party bypass around semantic evidence validation.

## Proof boundary

KMD-297 prevents accidental bypass through KnowMe's generic evidence CLI. It is not a cryptographic proof against a release-key holder intentionally editing JSON or code, and it does not establish the truth of external evidence.

Physical-device testing, App Store / Play Store submission, legal review, production infrastructure, DNS/TLS, monitoring/on-call, antimalware-provider validation, and restore drills still require real execution and retained evidence.
