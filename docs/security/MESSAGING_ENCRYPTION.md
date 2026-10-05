# KnowMe Messenger — message encryption at rest

## Status

This delivery protects new human Messenger message bodies before PostgreSQL persistence.

It is an **at-rest protection layer**, not end-to-end encryption. KnowMe API processes can still decrypt Cloud Chat messages while authorized, which is required by existing server-side features such as moderation, Nexus invocation and server search.

End-to-end encrypted Secret Chats require a separate device-key protocol and client rollout. This file must not be used to claim that the server is cryptographically unable to read normal Messenger conversations.

## Cryptography

- AES-256-GCM authenticated encryption.
- 96-bit random nonce per encrypted write.
- 128-bit authentication tag.
- fixed protocol AAD: `knowme:message-content:v1`.
- envelope prefix: `kmmsg:v1:`.
- optional binding of the encrypted payload to `conversationId` and `senderId`.
- tampered ciphertext fails authentication instead of being returned as corrupted plaintext.

The active storage key is selected by `KNOWME_MESSAGE_ENCRYPTION_KEY_ID`.

Recommended production configuration:

- `KNOWME_MESSAGE_ENCRYPTION_KEY`: exactly 32 random bytes encoded in base64;
- `KNOWME_MESSAGE_ENCRYPTION_KEY_ID`: a non-secret rotation identifier;
- `KNOWME_MESSAGE_ENCRYPTION_PREVIOUS_KEYS_JSON`: previous decrypt-only keys during rotation.

If the dedicated key is absent, the API can derive a domain-separated storage key from the existing `JWT_SECRET` with HKDF-SHA256. This compatibility path prevents new plaintext persistence during rollout, but a dedicated encryption key is preferred so authentication-key and storage-key lifecycles remain operationally separate.

## Persistence boundary

The Prisma boundary encrypts `Message.content` on create/update and decrypts authenticated envelopes on reads, including nested message results.

Legacy plaintext remains readable during migration so rollout is non-destructive.

Run this once against the target database after the new API code and encryption key are present:

```bash
pnpm --filter @knowme/api messages:encrypt:backfill
```

The backfill uses conditional updates so a message edited concurrently is not overwritten by an older value.

## Secondary plaintext copies

Messenger notifications no longer persist the message preview in `Notification.body`. They keep only a generic new-message notification plus routing metadata.

Server search no longer asks PostgreSQL to search `Message.content` ciphertext. It searches a bounded recent candidate window after Prisma has decrypted authorized message rows in application memory.

## Threat boundary

This layer materially reduces exposure from:

- database snapshots;
- accidental SQL exports;
- read-only database compromise;
- storage-provider access without the application encryption key.

It does **not** protect message plaintext from:

- a fully compromised authorized API process while the decryption key is available;
- a compromised unlocked user device;
- malicious code executed inside an authorized client;
- explicit user-authorized integrations that receive message content.

Those risks require endpoint security, hardened deployment and, for conversations that must be server-blind, a dedicated end-to-end encryption protocol.

## Next security layer

The E2EE design should use per-device identity keys, signed prekeys, one-time prekeys, forward secrecy, post-compromise recovery and safety-number/device verification. Do not invent a custom ratchet protocol; use a mature, reviewed Signal-style implementation or another audited standard suitable for Web, Android and iOS.
