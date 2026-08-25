# KMD-241 — Media quarantine retention observability

## Goal

Make the KMD-240 quarantine-retention worker operationally observable without exposing quarantined media or weakening the malware boundary.

## Delivered

- Adds an in-memory maintenance snapshot for the retention worker.
- Exposes `GET /admin/operations/media-quarantine-retention` behind JWT + `audit.read`.
- Reports only bounded operational data: enabled/running state, readiness, fixed interval and batch size, configured retention durations, last attempt/success/failure timestamps and the last aggregate result.
- Readiness states are `DISABLED`, `AWAITING_FIRST_RUN`, `HEALTHY`, `FAILING` and `STALE`.
- A configured worker becomes `STALE` after more than two complete sweep intervals without a new attempt.
- Production configuration remains fail-closed; the status path does not bypass the retention-policy validation from KMD-240.
- No media IDs, filenames, hashes, storage keys, owner IDs, scanner secrets, scanner URLs or audit rows are exposed.

## Validation

- Unit coverage verifies disabled and awaiting-first-run snapshots and preserves production fail-closed behavior.
- API E2E verifies 401 without authentication, 403 without `audit.read`, and the exact bounded response for an authorized administrator.
- Existing KMD-240 purge, claim-race and crash-resume tests remain in place.

## Migration

No Prisma migration or persisted-data migration is required. The operational snapshot is process-local and begins empty after each process restart.

## Rollback

Revert KMD-241. KMD-240 physical retention enforcement continues to operate; only the new status snapshot and admin endpoint are removed.

## Evidence boundaries

This milestone does not prove that object-storage deletion works in the production provider, that the legal retention durations are approved, that the malware provider is production-ready, or that the worker is globally singleton across multiple API instances. It also does not remove the KMD-228 market blocker.
