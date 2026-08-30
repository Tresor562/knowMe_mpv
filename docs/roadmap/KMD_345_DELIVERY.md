# KMD-345 — Enforce release repository governance

## Problem

The canonical repository can currently reach a green code CI while the GitHub `main` branch itself is unprotected. A market-release command therefore has no repository-governance gate proving that the canonical release branch requires reviewed pull requests, strict status checks, conversation resolution, administrator enforcement, and protection from destructive ref changes.

This is a real operational release risk. KMD-345 must not pretend that branch protection is enabled merely because code exists to check it.

## Delivery

- Add `scripts/github-release-governance-preflight.mjs`.
- Query the canonical GitHub repository, `main` branch, and branch-protection endpoint using read-only HTTPS requests.
- Fail closed unless all of the following hold at execution time:
  - repository identity is the expected canonical `owner/name`;
  - default and validated branch are the expected release branch;
  - the branch is protected;
  - at least one named required status check exists and strict/up-to-date status checking is enabled;
  - at least one approving pull-request review is required;
  - protections apply to administrators;
  - review conversations must be resolved;
  - force pushes and branch deletion are disabled.
- Reject failed GitHub responses instead of treating missing protection metadata as a pass.
- Make the guard independently runnable and include it in `check:market-ready`, so a commercial release cannot pass the canonical preflight while repository governance is missing.

## Tests

The Node test suite covers:

1. a complete compliant protection snapshot;
2. fail-closed rejection of an unprotected branch and weak review/status/destructive-ref settings;
3. repository/default-branch identity drift;
4. the exact GitHub endpoints and no-redirect request behavior using an injected Fetch implementation;
5. fail-closed handling of an unavailable/forbidden protection endpoint.

The new test is part of the root `pnpm test` command. Merge only if repository CI is green on the exact PR head and all review gates are clear.

## Migration

No Prisma migration, user-data migration, API contract migration, or release-evidence schema migration is required. This is an operational release-gate addition.

## Rollback

Revert the KMD-345 commits. No persistent application data rollback is required. A rollback removes the repository-governance market-release gate and therefore reopens the risk documented above.

## Operational requirement after merge

The code change does **not** enable GitHub branch protection. A repository administrator must configure the canonical branch to satisfy the guard. Until that real external configuration exists, `check:market-ready` is expected to fail at the repository-governance step.

If the GitHub API requires authentication for protection details, run the release check with a read-only `GITHUB_TOKEN` that can read repository metadata. The token is used only as an Authorization header and is never printed by the script.

## Proof boundary

KMD-345 proves only that the market-release tooling can fail closed against insufficient GitHub repository governance at the time it queries GitHub. It does not prove that protection has actually been enabled, that reviews occurred for any historical merge, or that legal, physical-device, production, restore, monitoring, or app-store validation has happened.
