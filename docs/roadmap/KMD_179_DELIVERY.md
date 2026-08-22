# KMD-179 — Production migration deploy gate

## Goal

Make production schema changes follow a complete committed Prisma migration history instead of relying on `prisma db push`, and prove in CI that a clean PostgreSQL database can be created from that history.

## Defect found during validation

The first clean migration-deploy run exposed an incomplete pre-release migration history. The repository contained later incremental migrations, but no committed migration creating the original core tables. KMD-066 therefore failed on a clean database because `User` and `Message` did not exist.

Earlier development and KMD validation had relied on `prisma db push`, which allowed the running schema to exist without a complete bootstrap history. KMD-179 treats that as a release blocker rather than hiding it with another `db push`.

## Delivered

- Added `@knowme/api prisma:migrate:deploy` using `prisma migrate deploy --schema prisma`.
- Added root `pnpm db:migrate:deploy` for deployment jobs.
- Replaced the incomplete pre-release incremental history with `20260801000000_kmd_179_release_baseline`, generated from the current Prisma datamodel before any production deployment has been claimed.
- The baseline contains the complete schema expected by the current application, including the core account, messaging and later KMD tables.
- CI now applies committed migrations to an empty PostgreSQL 16 database before build and test suites.
- The temporary baseline-generation workflow was removed after the baseline was committed; the final CI gate is read-only.
- Production migration sequencing, backup prerequisites and rollback boundaries are documented.

## Existing environment boundary

The release baseline is intended to establish a trustworthy migration starting point before market release. It must not be blindly applied to an existing database whose schema was previously created by `db push`, because its tables may already exist. Any such environment needs a reviewed schema-equivalence and migration-history reconciliation procedure first.

No existing environment or production database is claimed to have completed that transition in KMD-179.

## Validation

The final PR head must pass:

1. dependency installation;
2. Prisma client generation;
3. `pnpm db:migrate:deploy` against an empty PostgreSQL 16 database;
4. full monorepo build;
5. unit tests;
6. Chromium Web E2E;
7. PostgreSQL API E2E.

A migration failure is a release blocker and must not be bypassed with `prisma db push`.

## Release boundary

This KMD does not claim a production migration, deployment, provider maintenance window, backup verification or migration of an existing database. Those remain deployment evidence to collect on the target infrastructure.

## Rollback

Before deployment, reverting KMD-179 can restore the previous repository state for investigation. After a database has actually been migrated, an application-code revert must never be assumed to reverse the database schema. Schema corrections require an explicit migration or a verified incident-recovery procedure.
