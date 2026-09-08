# Next.js security refresh — 2026-09-08

The canonical CI production dependency audit detected GHSA-p293-qw3h-jr36 against Next.js 15.5.21.

The web workspace was upgraded to the patched exact version `next@15.5.24`, and `pnpm-lock.yaml` was regenerated with the repository-pinned pnpm version. The audit gate remains enabled and unsuppressed.

This commit also intentionally triggers the canonical CI after the lockfile refresh, because commits pushed by the one-shot GitHub Actions maintenance workflow do not recursively start new workflows.
