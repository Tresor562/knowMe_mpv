export const SECRET_CONVERSATION_MODE = 'SECRET' as const;
export const CLOUD_CONVERSATION_MODE = 'CLOUD' as const;
export const SECRET_MESSAGE_KINDS = ['PREKEY', 'RATCHET'] as const;
export type SecretMessageKind = (typeof SECRET_MESSAGE_KINDS)[number];

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
export const SECRET_MESSAGE_MAX_CIPHERTEXT_BYTES = 512 * 1024;

export function assertOpaqueCiphertext(value: string) {
  const trimmed = value.trim();
  if (
    trimmed.length < 24 ||
    trimmed.length > 131_072 ||
    !BASE64.test(trimmed)
  ) {
    throw new Error('SECRET_MESSAGE_CIPHERTEXT_INVALID');
  }

  let decoded: Buffer;
  try {
    decoded = Buffer.from(trimmed, 'base64');
  } catch {
    throw new Error('SECRET_MESSAGE_CIPHERTEXT_INVALID');
  }

  if (decoded.length < 16 || decoded.length > 98_304) {
    throw new Error('SECRET_MESSAGE_CIPHERTEXT_SIZE_INVALID');
  }

  return trimmed;
}

export function assertSecretEnvelopeBatchSize(
  envelopes: Array<{ ciphertext: string }>
) {
  const totalBytes = envelopes.reduce(
    (sum, envelope) =>
      sum + Buffer.from(envelope.ciphertext, 'base64').byteLength,
    0
  );
  if (totalBytes > SECRET_MESSAGE_MAX_CIPHERTEXT_BYTES) {
    throw new Error('SECRET_MESSAGE_BATCH_TOO_LARGE');
  }
  return totalBytes;
}

export function secretChatServerPolicy() {
  return {
    schemaVersion: 1,
    serverStoresPlaintext: false,
    serverDecryptsCiphertext: false,
    exactActiveDeviceFanoutRequired: true,
    allMembersRequireActiveE2eeDevice: true,
    cloudMessageEndpointBlockedForSecretConversations: true,
    serverModeratesSecretMessagePlaintext: false,
    maxCiphertextBatchBytes: SECRET_MESSAGE_MAX_CIPHERTEXT_BYTES,
    metadataVisibleToServer: [
      'conversationId',
      'senderUserId',
      'senderDeviceId',
      'recipientDeviceId',
      'timestamps',
      'ciphertextSize'
    ]
  } as const;
}
