# KMD-179 — Production migration deploy gate

## Goal

Make production schema changes follow the committed Prisma migration history instead of relying on `prisma db push`, and make CI prove that the migration chain can bootstrap a clean PostgreSQL database.

## Delivered

- Added `@knowme/api prisma:migrate:deploy` using `prisma migrate deploy --schema prisma`.
- Added root `pnpm db:migrate:deploy` for deployment jobs.
- Replaced the CI schema bootstrap step from `prisma:push` to `db:migrate:deploy` on a clean PostgreSQL 16 service.
- Documented development-vs-production migration responsibilities, backup prerequisites, concurrency boundaries and rollback expectations.

## Release boundary

This KMD does not claim that any production database was migrated. It only supplies and validates the production-safe command path in repository CI. The actual deployment runner, provider maintenance window, backup freshness and production migration execution remain external evidence.

## Validation

The PR must remain draft until the exact head passes:

1. dependency installation;
2. Prisma client generation;
3. `pnpm db:migrate:deploy` against an empty PostgreSQL 16 database;
4. full monorepo build;
5. unit tests;
6. Chromium Web E2E;
7. PostgreSQL API E2E.

A failure in step 3 is a release blocker and must not be bypassed with `prisma db push`.

## Rollback

Code rollback: revert KMD-179 to restore the previous scripts/CI. Do not use that rollback to justify `db push` in production.

Schema rollback: Prisma migrations are forward-applied. If a production schema change must be corrected, prefer a new corrective migration. Use database restoration only when the incident procedure explicitly calls for it and a verified backup exists. Never assume reverting application code reverses an already-applied database migration.
