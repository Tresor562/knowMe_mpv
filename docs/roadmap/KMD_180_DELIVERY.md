# KMD-180 — Prisma migration drift gate

## Goal

Prevent a release from passing when the committed Prisma migrations create a database schema that differs from the current Prisma datamodel.

## Delivered

After `pnpm db:migrate:deploy` has built an empty PostgreSQL 16 database from committed migrations, CI now runs Prisma `migrate diff` from that real database to the repository datamodel with `--exit-code`.

The gate succeeds only when the schemas are equivalent. A missing migration, an uncommitted schema change, an incorrect baseline or a migration that produces a different final shape blocks the pipeline before build and application E2E validation.

## Why this is separate from KMD-179

KMD-179 proved that the committed migration history can execute successfully from an empty database. Execution success alone does not prove that the resulting schema still matches `schema.prisma` and the modular Prisma datamodel files. KMD-180 closes that gap.

## Privacy and production boundary

The comparison runs only against the disposable CI PostgreSQL database. It does not inspect production data, copy rows, perform a production migration or claim that any deployed database is drift-free.

A real production drift check remains an operational action that must be planned against the target environment with appropriate backups and access controls.

## Validation

The PR remains draft until its exact final head passes:

1. dependency installation;
2. Prisma generation;
3. clean PostgreSQL 16 `db:migrate:deploy`;
4. zero-drift Prisma comparison;
5. full monorepo build;
6. unit tests;
7. Chromium Web E2E;
8. PostgreSQL API E2E.

## Rollback

Revert KMD-180 to remove the CI drift comparison. This rollback changes only the release gate and documentation; it must not be used to justify shipping a datamodel change without a corresponding migration.
