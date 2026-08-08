# Nexus account entitlements in KnowMe

## Product rule

Every authenticated KnowMe user can open the private Nexus conversation without linking a Nexus account. This baseline behaves like an integrated messaging assistant: Instant mode, bounded context/reply size, and a bounded hourly allowance.

Linking a Nexus account upgrades the private-chat entitlement according to the Nexus account plan: Free, Plus, Pro, or Business. Nexus remains the subscription authority. KnowMe never computes a paid plan from client state.

## Link flow

1. The user authenticates in Nexus and creates a short-lived one-time KnowMe link code.
2. The user enters the code on KnowMe `/nexus`.
3. The KnowMe API forwards the code to the authenticated Nexus server-to-server entitlement endpoint.
4. Nexus atomically consumes the code and returns only the linked Nexus user id plus a minimal entitlement profile.
5. KnowMe persists only the Nexus user id and last verified plan/status metadata.
6. On later entitlement reads/private turns, KnowMe refreshes authorization from Nexus server-to-server.
7. If Nexus cannot be reached, stale paid access is never retained; a linked account fails down to the linked Free profile.

No Nexus session token, API-provider key, OAuth token, Supabase service-role key, or payment credential is stored in KnowMe.

## Private-chat gating

Unlinked baseline currently allows Instant only with 12 completed private Nexus replies per rolling hour.

Linked accounts use the current Nexus-returned profile. Think is available where the profile allows it. Higher tiers can carry larger hourly/context/reply allowances. The current KnowMe social transport still supports Instant/Think only; entitlement flags for other Nexus products do not imply those tools execute inside the messaging surface yet.

Ordinary group `@Nexus` invocation keeps its existing explicit-mention contract and is not silently converted into the private subscription surface.

## Privacy lifecycle

- `GET /nexus-social/export` includes the stored Nexus account-link metadata.
- deleting the KnowMe account purges the Nexus account link alongside Nexus social records.
- `DELETE /nexus-social/account-link` disconnects Nexus without deleting the KnowMe account or private conversation.

## Security invariants

Subscription never weakens safety. Privacy boundaries, explicit group invocation, output provenance, secret protection, action approvals, device confirmation, and OS permissions are the same for Free, Plus, Pro, and Business.

## Deployment

This feature requires:

- current KnowMe Prisma schema/migration;
- `NEXUS_SERVER_URL`;
- the server-only `NEXUS_KNOWME_SHARED_SECRET` matching Nexus;
- the Nexus entitlement migration and endpoints deployed.

A merged code path is not proof that billing or production entitlement data is configured. Nexus paid plan rows remain controlled by the Nexus billing/subscription authority.
