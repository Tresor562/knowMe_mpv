# KMD-262 — Runtime release identity

## Goal

Bind a running production API process to the exact KnowMe Git commit and canonical release version that operators intend to validate and release.

## Delivered

- `KNOWME_RELEASE_COMMIT` is validated as an exact lowercase 40-character Git SHA.
- `KNOWME_RELEASE_VERSION` is validated as canonical SemVer without build metadata.
- Production startup fails closed when either value is absent or malformed.
- `/health`, `/health/live`, and `/health/ready` expose only the bounded `{ commit, version }` release identity alongside existing health data.
- Non-production environments may omit the identity so local development and tests remain usable.
- Unit tests cover missing, malformed, non-canonical, release-candidate, and valid values.

## Migration

Deployment configuration must set both variables to the exact candidate being deployed before production startup:

```text
KNOWME_RELEASE_COMMIT=<40-character lowercase Git SHA>
KNOWME_RELEASE_VERSION=<canonical SemVer, for example 1.0.0-rc.1>
```

The values should match the commit/version supplied to `pnpm check:market-ready`. Do not synthesize them independently.

## Rollback

Revert KMD-262. This removes production startup enforcement and release identity from health payloads. No database rollback is required.

## Proof boundary

This block makes deployment identity observable and fail-closed at runtime. It does **not** prove that DNS/TLS, the deployment smoke test, external monitoring, backup/restore, legal review, antimalware, physical-device validation, or store publication actually succeeded. Those remain external release evidence and must not be marked verified without real proof.

## Database

No Prisma migration is required.
