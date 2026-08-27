# KMD-271 — Market release evidence bundle finalizer

## Goal

Reduce release-operator error between evidence assembly, manifest signing, final validation, and digest capture.

## Delivered

- adds `pnpm release:evidence:finalize`;
- reads an unsigned schema-v4 market release manifest plus a directory of already-created evidence items;
- atomically applies exactly the remaining required evidence for the selected scope;
- signs the resulting manifest with the dedicated release-evidence HMAC key and key id;
- immediately re-runs the canonical market-evidence validator against the same commit, version, key id, and signing key;
- serializes the validated signed manifest once and computes SHA-256 from those exact output bytes;
- writes the signed manifest and digest record with exclusive creation (`wx`) and restrictive permissions when supported;
- never mutates the source manifest or evidence items.

## Security and proof boundaries

KMD-271 reduces accidental mismatch between intermediate release files. It does not create evidence and does not prove that an external artifact is truthful.

The following still require real retained evidence and human/operational validation where applicable:

- production DNS/TLS and domain control;
- production deployment and smoke execution;
- backup/restore drill and measured recovery behavior;
- external monitoring, alert delivery, and on-call escalation;
- privacy, terms, and legal review;
- data export/deletion validation;
- moderation/support/incident procedures;
- production antimalware provider validation;
- physical iOS/Android validation and store submissions for `FULL` scope.

The finalizer does not contact, fabricate, or mark any of these external facts as verified.

## Usage

```bash
KNOWME_RELEASE_EVIDENCE_SIGNING_KEY_ID=release-key-1 \
KNOWME_RELEASE_EVIDENCE_SIGNING_KEY='...' \
pnpm release:evidence:finalize -- \
  --manifest ./release-evidence.pending.json \
  --items-dir ./release-evidence-items \
  --output ./release-evidence.signed.json \
  --digest-output ./release-evidence.signed.sha256 \
  --commit <40-char-git-sha> \
  --version <canonical-semver>
```

Both output paths must be new files. Existing artifacts are never overwritten silently.

## Tests

The root test gate now covers:

- successful WEB_V1 finalization;
- same-byte SHA-256 calculation;
- post-signature canonical validation;
- missing evidence rejection;
- commit/version mismatch rejection;
- signing-key-id mismatch rejection;
- weak signing-key rejection;
- FULL-scope preservation.

## Migration

No Prisma migration is required. This is a release tooling change only.

## Rollback

Revert KMD-271. Operators can continue using the already-merged staged workflow:

1. `release:evidence:batch:apply`;
2. `release:evidence:sign`;
3. `check:market-ready`;
4. manually hash and retain the final signed manifest.
