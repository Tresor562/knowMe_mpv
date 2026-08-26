# KMD-256 — Market release evidence signing-key isolation

## Objective

Keep the HMAC trust boundary introduced by KMD-255 independent from the other production secrets used by KnowMe.

## Delivered

- adds a dedicated market-readiness signing-key preflight;
- requires `KNOWME_RELEASE_EVIDENCE_SIGNING_KEY` to be canonical and at least 32 characters;
- rejects reuse of the signing key as JWT, backup, storage, scanner, purge-alert, account-recovery, TURN, Nexus, sticker, payment/provider, or Apple private-key material when those values are configured;
- reports only environment-variable names, never secret values;
- runs the new regression suite from the root `pnpm test` command;
- runs the isolation check before the authenticated evidence manifest check in `pnpm check:market-ready`.

## Migration

No Prisma or user-data migration is required. Release operators must provision a dedicated secret value for `KNOWME_RELEASE_EVIDENCE_SIGNING_KEY` in the protected release secret-management boundary. Existing schema-v3 evidence manifests must only be re-signed when their retained evidence is intentionally revalidated.

## Rollback

Revert KMD-256. This restores the KMD-255 behavior where key strength/authenticity is checked but cross-secret reuse is not rejected. A rollback must not be represented as equivalent trust-boundary assurance.

## Proof boundary

This block proves configuration isolation only for values presented to the process. It does not prove secret-manager ACLs, HSM/KMS custody, key rotation, operator separation of duties, external evidence truth, production deployment, legal approval, physical-device validation, store submission, backup/restore execution, monitoring delivery, incident response, or antimalware exercises.
