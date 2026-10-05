# KnowMe Secret Chats — E2EE architecture

## Goal

KnowMe uses two distinct security modes, deliberately similar to the useful separation between cloud-synchronized chats and device-bound end-to-end encrypted chats:

1. **Cloud Chats** — synchronized across devices and protected in transit plus encrypted at rest on KnowMe infrastructure.
2. **Secret Chats** — end-to-end encrypted. Message plaintext and private conversation keys must never be available to the KnowMe server.

This document describes the E2EE foundation only. It does not claim that Secret Chat message encryption is complete until reviewed client-side session establishment, ratcheting, device verification and real-device tests are deployed.

## Non-negotiable rules

- Never invent a home-grown ratchet or key-agreement protocol.
- Use a maintained, reviewed libsignal-compatible implementation suitable for the target platform.
- Every device owns its private identity/session key material locally.
- KnowMe servers store and distribute **public key material only**.
- Private keys must be kept in Android Keystore / iOS Keychain or an equivalent platform secure store.
- Web support must use an appropriate secure local-key strategy and must clearly communicate the weaker browser trust boundary.
- A server/database compromise must not reveal Secret Chat plaintext.
- A compromised historical session key must not unlock the whole conversation history once forward-secrecy ratcheting is active.
- Identity-key changes must be visible to participants and must never be silently accepted.
- Key material, decrypted plaintext and ratchet state must never be written to application logs, analytics or crash reports.

## Server key directory delivered by this change

Each authenticated KnowMe session may register one active E2EE public-key bundle.

The server stores:

- protocol version identifier;
- public identity key;
- public signed prekey;
- signature over the signed prekey;
- bounded one-time public prekeys;
- non-secret registration metadata.

The server never accepts a private key field.

A device registration is bound to an active AuthSession. If that session is revoked or expired, the key bundle is excluded from new bundle claims.

Replacing an identity key in place is forbidden. A changed identity requires a fresh authenticated session/device registration so the security event is explicit instead of silently mutating an established identity.

## Bundle claiming

A client may claim a recipient key bundle only inside a KnowMe conversation where:

- the requester is currently a member;
- the target user is currently a member.

At most one one-time prekey is consumed for each target device. Claiming is performed in a serializable database transaction, and one-time prekeys use conditional consumption so the same record is not intentionally handed out twice.

A bundle may be returned without a one-time prekey if that device's prekey pool is temporarily empty. Clients should prompt/retry replenishment according to the reviewed libsignal integration rather than weakening identity verification.

## Opaque Secret Chat message transport

The server now has a separate Secret Chat persistence path that stores only opaque per-device ciphertext envelopes.

A Secret Chat conversation is marked with `encryptionMode=SECRET`. Existing Cloud Chat message, edit and sticker endpoints fail closed for these conversations, so Secret Chat content cannot be accidentally persisted through the normal plaintext `Message.content` path.

For each Secret Chat send:

- the sender must be an active E2EE device bound to the authenticated session;
- every conversation member must currently have at least one active E2EE device;
- the client must provide exactly one opaque ciphertext envelope for every active target device except the sending device;
- duplicate, missing or extra recipient-device envelopes are rejected;
- the server validates only bounded encoding/size and routing metadata; it does not decrypt or interpret ciphertext;
- retries are idempotent by sender-device + client-message id;
- recipient inboxes expose only envelopes addressed to that authenticated E2EE device;
- realtime notifications contain message availability metadata only, never ciphertext or plaintext.

The server can still observe unavoidable routing metadata such as participants, device identifiers, timestamps and ciphertext sizes. This is not metadata-hiding or traffic-analysis resistance.

Clients can query a non-consuming per-conversation identity directory to obtain active device identity fingerprints without burning a one-time prekey. KnowMe must pin these fingerprints locally and warn users when a participant adds or changes a cryptographic device before silently trusting the new identity.

A client message id is cryptographically bound on the server to a SHA-256 digest of the protocol identifier plus the exact sorted ciphertext-envelope set. Retrying the identical encrypted payload is idempotent; reusing the same client message id with different ciphertext, message kind or recipients fails closed.

Auth-session cleanup no longer deletes cryptographic device records automatically. A retired E2EE device loses active-session eligibility but can remain as historical routing/key metadata until normal account/data-lifecycle cleanup removes it.

## Planned client layer

The next delivery must integrate the reviewed cryptographic library on Android/iOS first and cover:

- device identity creation;
- signed-prekey generation and verification;
- one-time-prekey generation/replenishment;
- session establishment;
- the ratchet supplied by the reviewed library;
- per-device fan-out for multi-device accounts;
- safety-number / QR verification;
- explicit warnings for identity changes;
- encrypted attachments with independent random media keys;
- secure deletion of local ratchet/session state;
- backup behavior that never uploads plaintext private keys;
- loss/recovery flows that do not create a hidden server decryption key.

## Threat boundary

This architecture is designed to resist server/database disclosure of Secret Chat content once client E2EE is fully wired.

It cannot make any product literally impossible to compromise. An attacker controlling an unlocked endpoint, malicious operating-system code, a participant's device, or code running inside the trusted client process may still access plaintext available on that endpoint. KnowMe therefore needs endpoint hardening, supply-chain controls, rate limiting, dependency patching and external security review in addition to E2EE.
