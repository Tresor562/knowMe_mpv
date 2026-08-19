# KMD-151 — Mobile authenticated surface identity isolation

## Scope

KnowMe core Mobile only.

KMD-151 prevents identity-local state in the authenticated Mobile shell from surviving an authenticated `user.id` change without a full application remount.

The shell now returns to `Accueil` whenever the active authenticated identity changes, and the authenticated surfaces are mounted with identity-scoped React keys:

- Accueil;
- Fil;
- Cercle;
- Défis;
- Profil;
- Vérification.

This ensures local component state, pending UI navigation state, cached lists, form state, and per-surface busy/error state cannot remain attached to the previous authenticated identity after a session replacement or account-context change.

## Authority and safety boundaries

- No new API or endpoint.
- No schema or persistence change.
- No migration.
- No authorization widening.
- No membership or role mutation.
- No Nexus core or Nexus × KnowMe integration change.
- No Premium, KnowCoins, call, hardware/device, legal, OS-permission, or KMD-059 change.

Existing server-side authorization remains authoritative. The change only hardens Mobile presentation-state isolation.

## Validation

KMD-151 must remain unmerged until the repository's standard CI is fully green:

- Prisma client generation and schema push;
- complete monorepo build, including the Mobile TypeScript build;
- complete unit suite;
- PostgreSQL API E2E suite.

The Mobile package exposes `build` (`tsc --noEmit`) but no dedicated component-test runner. For this narrow shell-level state-isolation change, the adapted automated Mobile gate is therefore the Mobile TypeScript build inside the monorepo plus the repository's existing unit and authorization E2E suites.

Diff review must confirm that:

1. an authenticated identity change returns the shell to `Accueil`;
2. each authenticated surface is remounted under a key derived from the active `user.id`;
3. profile refreshes for the same identity do not change authority or request contracts;
4. logout/account deletion still clears the local session and returns to `Accueil`;
5. no Nexus, call, entitlement, hardware, legal, migration, or server-authority code is touched.

## Rollback

Remove the identity-change `useEffect`, restore the authenticated surfaces without identity-scoped React keys, and remove this delivery document.

No database rollback is required.
