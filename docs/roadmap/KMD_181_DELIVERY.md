# KMD-181 — Production dependency security gate

## Goal

Prevent a market release from silently shipping a production dependency with a known high or critical security advisory reported by the package registry audit service.

## Delivered

CI now runs `pnpm audit --prod --audit-level=high` immediately after dependency installation. The check covers production dependency resolution from the committed lockfile and blocks the pipeline before database, build and E2E validation when a high or critical advisory is detected.

Development-only packages are intentionally outside this release gate because they are not shipped as application runtime dependencies. They can still be reviewed separately during maintenance.

## Security boundary

An advisory audit is one signal, not proof that the application is vulnerability-free. It does not replace code review, threat modeling, penetration testing, provider patching, container/OS scanning or disclosure handling.

Registry availability and advisory freshness are external dependencies. A registry outage must be investigated rather than converted into a permanent audit bypass.

## Validation

Keep the PR draft until the exact head passes:

1. dependency installation;
2. production dependency audit with no high/critical advisory;
3. Prisma generation;
4. clean PostgreSQL migration deploy;
5. zero-drift schema comparison;
6. full build;
7. unit tests;
8. Chromium Web E2E;
9. PostgreSQL API E2E.

If the audit reports a relevant vulnerability, update or replace the affected dependency and rerun the complete gate. Do not suppress an advisory solely to make CI green.

## Rollback

Revert KMD-181 to remove the registry audit gate. This changes CI only and does not remove any already-installed vulnerability from a deployed system. A dependency security incident requires an explicit dependency update, mitigation or rollback to a known-safe application version.
