# KnowMe × Nexus OS — product-side integration

Status: **implemented behind a fail-closed kill switch**.

This layer is the KnowMe-owned executor for the reusable V13 contracts defined in `Tresor562/Nexus-Ai-`. It does not give Nexus database, SQL, shell, filesystem, credential or generic command access.

## Server boundary

Internal endpoints:

- `GET /internal/nexus/status`
- `POST /internal/nexus/actions`

Both require a server-only Bearer secret of at least 32 bytes (`NEXUS_KNOWME_SHARED_SECRET`). Browser/mobile clients must never receive this secret.

The integration is disabled unless `NEXUS_INTEGRATION_ENABLED=true`.

## Executable capabilities

The first product executor intentionally implements only capabilities that have a bounded authoritative KnowMe primitive:

- application status/release evidence/feature-flag reads;
- approved feature-flag enable/disable;
- bounded account profile reads;
- session revocation for self/operator support;
- operator-only suspension/restoration with session revocation on suspension;
- game catalog and authorized session summaries;
- operator security audit summaries;
- bounded avatar metadata;
- operator moderation queue summaries;
- authorized conversation/group context limited to the latest 30 messages.

Capabilities from the broader V13 manifest that do not yet have a sufficiently narrow product primitive remain unavailable. KnowMe rejects them instead of simulating a successful action.

## Authorization and safety

Each request is revalidated by KnowMe. It must contain the exact scope required by the capability. Mutations require both an approval ID and an idempotency key. Operator/destructive actions additionally require a meaningful reason and the Nexus actor ID must be present in `NEXUS_KNOWME_OPERATOR_NEXUS_IDS_JSON`.

Arguments are bounded by size, nesting depth, strings and arrays. Keys associated with SQL, database access, credentials, passwords, secrets, tokens, private keys, shell, scripts, commands or raw queries are rejected recursively.

Reads respect KnowMe user/conversation boundaries. Operator-only queues do not expose message bodies or credentials.

## Audit and idempotency

`NexusIntegrationReceipt` stores request/capability identity, risk, approval/idempotency identifiers, outcome and bounded structured response. An audit event is also emitted through the existing KnowMe observability layer.

The receipt exists to support retries and traceability; consequential capabilities must never rely only on a model-generated claim of approval.

## Rollout

1. deploy schema and code with `NEXUS_INTEGRATION_ENABLED=false`;
2. configure the same high-entropy shared secret on Nexus and KnowMe servers;
3. configure operator Nexus IDs explicitly if destructive operations are needed;
4. verify internal status/read calls;
5. enable the kill switch progressively;
6. keep feature-flag/action receipts and audit logs under review;
7. disable `NEXUS_INTEGRATION_ENABLED` immediately to stop product execution without disabling ordinary KnowMe APIs.

Nexus Social delivery is a separate integration branch and is not coupled to this executor.
