# Integration ownership

## Nexus AI core side

The Nexus AI work stream defines and versions reusable integration contracts:

- Nexus API / SDK;
- tool schemas;
- model-routing contracts;
- safety and permission contracts;
- authentication/service-token expectations;
- observability and audit metadata;
- provider-independent request/response types.

It must not mutate KnowMe application internals based on stale assumptions.

## KnowMe application side

The KnowMe work stream is responsible for attaching those contracts to the current application because it owns the latest:

- user/account domain;
- messaging and groups;
- games;
- security/moderation;
- avatars;
- events/items/themes;
- Web/Mobile surfaces;
- database schema and migrations;
- permissions and deletion/export behavior.

## Integration review

A Nexus × KnowMe integration PR should therefore be reviewed from both sides:

1. Nexus contract compatibility;
2. KnowMe domain/permission correctness;
3. security and privacy boundaries;
4. tests and rollback;
5. deployment feature flags.

No integration is considered complete until both repositories' live continuity checkpoints have been reconciled.
