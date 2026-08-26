# KMD-261 — Market release evidence URI scheme hardening

## Goal

Make retained market-release evidence references fail closed against URI schemes and URL components that can embed unsafe, local, executable, or ephemeral references.

## Delivered

- `evidenceRef` now accepts only:
  - `https:` references with a hostname; or
  - the existing internal `evidence:` registry scheme with a hostname.
- Plain HTTP, `file:`, `data:`, `javascript:`, FTP and other unapproved schemes are rejected.
- Query strings and fragments are rejected for both allowed schemes so release manifests cannot retain signed URLs, bearer-like query tokens, or unstable fragment-only references.
- Embedded URI credentials remain rejected.
- Existing length, control-character, HMAC, commit, version, key identity, expiry and evidence SHA-256 checks remain enforced.
- A dedicated regression suite is wired into the root `pnpm test` gate.

## Migration

No Prisma migration is required.

Before signing a new market-release evidence manifest, replace any evidence reference that uses HTTP, local/file URLs, query parameters, fragments or another unapproved scheme with a stable credential-free HTTPS permalink or an entry in the internal `evidence:` registry.

Already-signed manifests that contain newly forbidden references must be regenerated and re-signed after their references are migrated. Do not rewrite an authenticated manifest in place without re-signing it.

## Rollback

Revert the KMD-261 commits. This restores the broader absolute-URI acceptance policy without touching product data, Prisma schema, evidence artifacts, or the HMAC format.

Rollback weakens the release-evidence boundary and should only be used to recover from an implementation regression, not to permit secret-bearing or local evidence links.

## Proof boundary

This block validates reference syntax and transport scheme only. It does not fetch the referenced artifact, prove that HTTPS/TLS is correctly configured, verify artifact availability, validate access-control policy on the evidence store, prove the verifier identity, or prove any external launch requirement.

A passing KMD-261 gate is therefore not evidence of production deployment, legal review, backup/restore success, monitoring/on-call readiness, antimalware-provider validation, physical-device testing or store publication.
