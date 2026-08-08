# KnowMe × Nexus Social — product-side V14 integration

Status: **implemented behind two fail-closed kill switches**.

This layer connects the already-merged Nexus V14 Social Gateway to KnowMe messaging without turning Nexus into a normal human account and without giving Nexus hidden access to conversations.

## Surfaces

### Private Nexus conversation

A signed-in KnowMe user explicitly opens a dedicated private Nexus conversation from Messages. The conversation contains only that KnowMe user as a human member. Nexus replies are stored separately as `NexusSocialReply` records and are presented with the synthetic assistant identity `nexus.ai` / `Nexus`.

Nexus is not inserted into the `User` table and never impersonates a participant.

### Group invocation

Nexus replies in a group only when the current source message:

- belongs to the authenticated invoking user;
- belongs to that group conversation;
- is still the latest turn when the invocation is authorized;
- contains an explicit `@Nexus` mention.

A fresh explicit mention is required for every later Nexus group reply. There is no background subscription or autonomous group listening.

Ordinary direct messages between people do not acquire Nexus automatically. Direct Nexus use belongs to the explicit private Nexus surface.

## Context minimization

KnowMe sends only a bounded conversation envelope to Nexus:

- current conversation only;
- at most 99 human members plus the synthetic Nexus participant;
- at most the latest 30 combined human/Nexus messages;
- message content capped by the Nexus V14 contract;
- no hidden conversation lookup;
- no contacts, private chats, deleted content, device data, account secrets or unrelated user profile data.

Nexus V14 independently validates supplied participants, authors and explicit invocation before generating a reply.

## Delivery authority

The Nexus gateway intentionally returns `deliveryAuthorized: false`.

KnowMe will deliver a generated reply only if the envelope exactly matches the request ID, conversation ID and surface that KnowMe generated for the current turn. KnowMe then performs the authoritative persistence, realtime fanout, notification and audit operations itself.

This means a model response cannot authorize its own insertion into KnowMe.

## Idempotency and stale-turn protection

Every client invocation supplies an idempotency key. KnowMe enforces one stored reply per conversation/idempotency key and one reply per source message.

Before sending context to Nexus, KnowMe rejects a stale source turn when a newer human or Nexus message already exists in the conversation.

The user's source message is persisted before the Nexus request. If Nexus is unavailable, times out or returns an invalid envelope, the human message remains intact and the client reports only the assistant failure.

## Storage and identity

Human messages continue to use the existing `Message` model with a real `User.senderId`.

Nexus output uses `NexusSocialReply`, keeping assistant-authored content structurally separate. The messaging service merges both streams only at presentation/history time and supplies a synthetic, clearly labeled Nexus sender.

This avoids fake accounts, participant impersonation and accidental assignment of ordinary user permissions to Nexus.

## Server configuration

Required server-only settings:

- `NEXUS_INTEGRATION_ENABLED=true` — global Nexus × KnowMe kill switch;
- `NEXUS_SOCIAL_ENABLED=true` — independent social kill switch;
- `NEXUS_SERVER_URL=https://...` — deployed Nexus server origin;
- `NEXUS_KNOWME_SHARED_SECRET` — same high-entropy server-to-server secret configured on both deployments;
- `NEXUS_SOCIAL_TIMEOUT_MS` — bounded 3–30 second server timeout, default 20 seconds.

`NEXUS_SERVER_URL` must use HTTPS in production and may not contain embedded credentials, query parameters or fragments. None of these values are exposed through browser/mobile public environment variables.

## Realtime and unread behavior

Nexus replies use the existing authenticated Socket.IO conversation/user rooms. They participate in conversation previews, unread counts, history pagination and mark-read timestamps while remaining a distinct stored entity.

Web and Mobile use only the authenticated KnowMe API. They never receive Nexus provider credentials or the shared server secret.

## Rollout

1. deploy schema/code with both kill switches disabled;
2. configure the Nexus server origin and shared secret;
3. verify server-to-server `social.manifest` / `social.reply` connectivity in staging;
4. enable `NEXUS_INTEGRATION_ENABLED` while keeping `NEXUS_SOCIAL_ENABLED=false` if V13 OS capabilities are being tested separately;
5. enable `NEXUS_SOCIAL_ENABLED` progressively;
6. test private conversations and group `@Nexus` invocation on Web and Mobile;
7. monitor Nexus social audit events, timeout/error rates and provider availability;
8. disable `NEXUS_SOCIAL_ENABLED` immediately to stop assistant delivery without disabling human messaging.

## Explicit exclusions

This milestone does not add:

- hidden/background reading of groups;
- automatic replies without a current invocation;
- unrestricted database access;
- a fake human Nexus account;
- arbitrary moderator/admin authority;
- cross-conversation memory lookup from KnowMe;
- delivery authorization controlled by the AI response;
- exposure of model/provider credentials to clients.

External model availability remains dependent on the Nexus deployment and its configured provider credentials.