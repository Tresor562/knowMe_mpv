# KMD-214 — Backup artifact safety

## Goal

Prevent a failed or repeated PostgreSQL backup from silently overwriting a previously valid recovery artifact or leaving behind a partial sensitive dump that can later be mistaken for a usable backup.

## Changes

- backup destinations fail closed when either the requested `.dump` file or its `.manifest.json` companion already exists;
- manifest paths are derived through one canonical helper;
- `pg_dump` is never allowed to overwrite a previously existing recovery artifact through the KnowMe wrapper;
- when backup creation has started and any later step fails, the wrapper removes the partial dump and orphan manifest idempotently;
- manifest creation uses exclusive `wx` semantics so a race cannot silently replace an existing manifest;
- successful dump and manifest permissions remain restricted to the existing owner-only mode.

## Tests

The existing PostgreSQL backup test suite now covers:

- refusal when a dump already exists;
- refusal when only an orphan manifest exists;
- cleanup of partial sensitive dump + manifest artifacts;
- idempotent cleanup.

The full repository merge gate remains production dependency audit, Prisma generation, `migrate deploy`, zero drift, monorepo build, unit tests, Chromium Web E2E and PostgreSQL API E2E on the exact PR head.

## Migration

No Prisma migration and no application-data schema change.

## Rollback

Revert KMD-214. Existing valid backup artifacts are not modified by the rollback. Reverting reintroduces overwrite/partial-artifact risk in the wrapper and should only be done for an emergency compatibility problem followed by a forward fix.

## External evidence still required

This block does not claim that production backups are scheduled, remotely replicated, encrypted by the target storage provider, retained under an approved policy, or proven restorable. A real isolated recovery drill with measured RPO/RTO remains mandatory release evidence.
