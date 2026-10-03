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
