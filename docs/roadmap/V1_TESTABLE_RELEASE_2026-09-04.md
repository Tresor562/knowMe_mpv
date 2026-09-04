# KnowMe V1 — Testable release candidate

Date: 2026-09-04
Branch: `v1-testable-2026-09-04`
Baseline: `main` after KMD-378 merge (`7c0d77d088f3ffde996c39b10fb5a6f7f8efb7f7`)

## Purpose

This branch is the dedicated V1 candidate used to validate the current KnowMe repository as a user-testable release without claiming unsupported production/store readiness.

## Included baseline

- Web application (`apps/web`) with Next.js build and Playwright E2E entrypoint.
- API (`apps/api`) with NestJS build, Jest/E2E tests, Prisma migrations and PostgreSQL-backed release validation.
- Current PLAY / DISCOVER / CONNECT / CREATE implementation present on canonical `main`.
- Guest-play, account, social/game and media flows present in the current repository baseline.
- KMD-376 media tombstone/download fencing.
- KMD-377 explicit media-access revocation fencing.
- KMD-378 derived FRIENDS/CONVERSATION download-authority repair and token cleanup.

## Candidate gate

The candidate is acceptable for V1 user testing only after the pull-request exact head passes the repository's canonical required checks, including:

1. dependency/supply-chain policy checks;
2. frozen `pnpm` install and production dependency audit;
3. Prisma generation, migration deployment and datamodel/migration consistency;
4. monorepo build;
5. automated test suite;
6. API runtime-container build and boot/readiness probes;
7. Runtime readiness workflow;
8. no unresolved blocking review thread on the candidate PR.

A failed gate means the candidate is not to be presented as validated.

## Local test bootstrap

Requirements:

- Node.js 22.23.2 (the CI runtime);
- pnpm 10.13.1;
- PostgreSQL 16-compatible database.

Typical validation flow:

```bash
pnpm install --frozen-lockfile
pnpm --filter @knowme/api prisma:generate
pnpm db:migrate:deploy
pnpm build
pnpm test
pnpm dev
```

The web app uses `NEXT_PUBLIC_API_URL`; the API requires its documented runtime environment including `DATABASE_URL` and an adequate `JWT_SECRET`.

## V1 test focus

User testing should cover, at minimum:

- first launch and guest entry;
- account registration/login/session lifecycle;
- PLAY entry points and game completion/scoring/replay paths;
- DISCOVER content navigation;
- CONNECT/social/friend/conversation paths;
- CREATE paths currently exposed by the UI;
- private/conversation/friends media authorization and download behavior;
- account deletion/session revocation;
- responsive Web behavior and obvious broken/blank/dead-end screens.

Any issue found during this pass must be logged against this candidate before a production claim.

## Explicit boundary

This is a **testable V1 candidate**, not a claim that KnowMe is already market/store ready. The repository itself still distinguishes code validation from external evidence such as physical supported-device testing, legal/privacy review, production backup/restore evidence, production monitoring/alert delivery, real production object-storage validation, orchestrator/load-balancer proof and App Store/Google Play review/publication.

Those external proofs are not required to hand a controlled V1 candidate to testers, but they remain required before stronger production/market-readiness claims where applicable.
