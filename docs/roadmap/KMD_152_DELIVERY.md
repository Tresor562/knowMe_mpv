# KMD-152 — Web session authority refresh fail-closed

## Scope

KnowMe core Web only.

KMD-152 hardens the shared Web `useSession` hook so authenticated profile state cannot remain visible as freshly authorized while `/users/me` is being revalidated or after a newer refresh supersedes an older request.

## Behavior

- Every session refresh immediately enters a loading state and clears the previously rendered session user.
- Concurrent or superseded refreshes are generation-scoped; late responses from older requests are ignored.
- Unmount invalidates in-flight refresh work so a stale response cannot republish state into a replaced surface.
- Logout invalidates in-flight refresh work before clearing the local session and redirecting.
- Missing/invalid sessions continue to disconnect realtime, clear local credentials where appropriate, and redirect required surfaces to `/login`.

## Authority and safety boundaries

- No new endpoint or API contract.
- `/users/me` remains the only profile authority used by this hook.
- No schema or persistence change.
- No migration.
- No authorization widening.
- No membership, role, entitlement, Premium, KnowCoins, call, device, hardware, legal, or OS-permission change.
- No Nexus core or Nexus × KnowMe integration change.
- No KMD-059 change.

## Validation

KMD-152 must remain unmerged until the repository CI is fully green:

- Prisma client generation and schema push;
- complete monorepo build, including the Next.js Web build;
- complete unit suite;
- PostgreSQL API E2E suite;
- any Web/Playwright checks already included by the repository workflow.

The Web package currently has no dedicated unit-test runner for React hooks. The adapted gate for this shared client hook is therefore TypeScript/Next.js compilation plus the repository's existing automated suites and diff review.

Diff review must confirm that:

1. stale `user` state is cleared before a refresh is treated as authoritative;
2. a late response from an older refresh cannot overwrite a newer session result;
3. unmount/logout invalidate pending session refreshes;
4. existing required-session redirect and realtime cleanup behavior remain intact;
5. no server authorization or cross-repository integration code is touched.

## Migration

None.

## Rollback

Restore `apps/web/lib/use-session.ts` to the pre-KMD-152 refresh behavior and remove this delivery document. No database rollback is required.
