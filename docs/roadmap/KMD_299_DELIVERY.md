# KMD-299 — Market release evidence manifest initializer

## Goal

Create the unsigned market-release evidence manifest from the exact release candidate identity and the canonical evidence contract instead of copying or manually editing a stale example.

## Delivery

KMD-299 adds:

- `pnpm release:evidence:init`;
- exact `WEB_V1` and `FULL` evidence slot generation through `requiredEvidenceForScope()`;
- schema v4, `PRODUCTION`, release commit, release version and `signingKeyId` binding at initialization time;
- every evidence slot starts as `PENDING`;
- an explicit zero HMAC marker so the result cannot be confused with a signed manifest;
- canonical validation of commit, SemVer and signing-key identity before writing;
- exclusive `wx` creation with restrictive permissions where supported;
- regression coverage wired into the root test gate.

Example:

```sh
pnpm release:evidence:init -- \
  --scope WEB_V1 \
  --commit "$KNOWME_RELEASE_COMMIT" \
  --version "$KNOWME_RELEASE_VERSION" \
  --signing-key-id "$KNOWME_RELEASE_EVIDENCE_SIGNING_KEY_ID" \
  --output ./release-evidence.pending.json
```

The command never marks evidence as verified and never signs the manifest. Dedicated semantic evidence binders, finalization, retained-bundle verification and `pnpm check:market-ready` remain required.

## Migration

No Prisma or user-data migration is required. Release operators may replace hand-authored pending manifests with the initializer for new release candidates. Existing valid retained bundles remain unchanged.

## Rollback

Revert KMD-299 and return to the previous manual creation of an unsigned schema-v4 manifest. No persisted application state is affected.

## Proof boundary

Successful initialization proves only that the manifest skeleton matches the repository's current evidence IDs and the supplied release identity. It does not prove TLS/DNS, deployment, backup restore, monitoring/on-call, legal/privacy review, data deletion/export behavior, moderation operations, antimalware operation, physical-device validation or store submission. Those facts require their real external evidence and the existing semantic binders.
