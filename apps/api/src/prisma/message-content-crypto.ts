import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes
} from 'crypto';

const ENVELOPE_PREFIX = 'kmmsg:v1:';
const AAD = Buffer.from('knowme:message-content:v1', 'utf8');
const KEY_ID_PATTERN = /^[A-Za-z0-9._-]{1,32}$/;

type MessageCryptoContext = {
  conversationId?: string | null;
  senderId?: string | null;
};

type KeyEntry = {
  id: string;
  key: Buffer;
};

type KeyRing = {
  active: KeyEntry;
  byId: Map<string, Buffer>;
};

type SerializedPayload = {
  v: 1;
  content: string;
  conversationId?: string;
  senderId?: string;
};

function parseDedicatedKey(value: string, label: string): Buffer {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is empty.`);

  let key: Buffer;
  try {
    key = Buffer.from(trimmed, 'base64');
  } catch {
    throw new Error(`${label} must be base64 encoded.`);
  }
  if (key.length !== 32) {
    throw new Error(`${label} must decode to exactly 32 bytes.`);
  }
  return key;
}

function validateKeyId(value: string, label: string) {
  if (!KEY_ID_PATTERN.test(value)) {
    throw new Error(`${label} must match ${KEY_ID_PATTERN}.`);
  }
  return value;
}

function deriveJwtSeparatedKey(secret: string): Buffer {
  if (!secret.trim()) throw new Error('JWT_SECRET is empty.');
  return Buffer.from(
    hkdfSync(
      'sha256',
      Buffer.from(secret, 'utf8'),
      Buffer.from('knowme-message-storage-salt-v1', 'utf8'),
      Buffer.from('knowme-message-storage-aes-256-gcm', 'utf8'),
      32
    )
  );
}

function resolveKeyRing(env: NodeJS.ProcessEnv): KeyRing {
  const activeId = validateKeyId(
    env.KNOWME_MESSAGE_ENCRYPTION_KEY_ID?.trim() || 'primary',
    'KNOWME_MESSAGE_ENCRYPTION_KEY_ID'
  );

  const dedicatedKey = env.KNOWME_MESSAGE_ENCRYPTION_KEY?.trim();

  if (env.NODE_ENV === 'production' && !dedicatedKey) {
    throw new Error(
      'KNOWME_MESSAGE_ENCRYPTION_KEY is required in production.'
    );
  }

  const activeKey = dedicatedKey
    ? parseDedicatedKey(
        dedicatedKey,
        'KNOWME_MESSAGE_ENCRYPTION_KEY'
      )
    : env.JWT_SECRET?.trim()
      ? deriveJwtSeparatedKey(env.JWT_SECRET)
      : env.NODE_ENV === 'test'
        ? deriveJwtSeparatedKey('knowme-test-only-message-encryption-key')
        : null;

  if (!activeKey) {
    throw new Error(
      'KnowMe message encryption requires KNOWME_MESSAGE_ENCRYPTION_KEY or a non-production JWT_SECRET fallback.'
    );
  }

  const byId = new Map<string, Buffer>([[activeId, activeKey]]);
  const previousRaw = env.KNOWME_MESSAGE_ENCRYPTION_PREVIOUS_KEYS_JSON?.trim();
  if (previousRaw) {
    let previous: unknown;
    try {
      previous = JSON.parse(previousRaw);
    } catch {
      throw new Error(
        'KNOWME_MESSAGE_ENCRYPTION_PREVIOUS_KEYS_JSON must be valid JSON.'
      );
    }
    if (!Array.isArray(previous)) {
      throw new Error(
        'KNOWME_MESSAGE_ENCRYPTION_PREVIOUS_KEYS_JSON must be a JSON array.'
      );
    }
    for (const item of previous) {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof (item as { id?: unknown }).id !== 'string' ||
        typeof (item as { key?: unknown }).key !== 'string'
      ) {
        throw new Error(
          'Each previous message encryption key must contain string id and key fields.'
        );
      }
      const id = validateKeyId(
        (item as { id: string }).id,
        'Previous message encryption key id'
      );
      if (byId.has(id)) {
        throw new Error(`Duplicate message encryption key id: ${id}.`);
      }
      byId.set(
        id,
        parseDedicatedKey(
          (item as { key: string }).key,
          `Previous message encryption key ${id}`
        )
      );
    }
  }

  return { active: { id: activeId, key: activeKey }, byId };
}

function encode(value: Buffer) {
  return value.toString('base64url');
}

function decode(value: string, label: string) {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`Invalid encrypted message ${label}.`);
  }
  return Buffer.from(value, 'base64url');
}

export function assertMessageEncryptionRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): void {
  resolveKeyRing(env);
}

export function isEncryptedMessageContent(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(ENVELOPE_PREFIX);
}

export function encryptMessageContent(
  plaintext: string,
  context: MessageCryptoContext = {},
  env: NodeJS.ProcessEnv = process.env
): string {
  if (isEncryptedMessageContent(plaintext)) return plaintext;

  const ring = resolveKeyRing(env);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', ring.active.key, iv);
  cipher.setAAD(AAD);

  const payload: SerializedPayload = {
    v: 1,
    content: plaintext,
    ...(context.conversationId
      ? { conversationId: context.conversationId }
      : {}),
    ...(context.senderId ? { senderId: context.senderId } : {})
  };

  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return [
    ENVELOPE_PREFIX.slice(0, -1),
    ring.active.id,
    encode(iv),
    encode(tag),
    encode(ciphertext)
  ].join(':');
}

export function decryptMessageContent(
  stored: string,
  context: MessageCryptoContext = {},
  env: NodeJS.ProcessEnv = process.env
): string {
  if (!isEncryptedMessageContent(stored)) return stored;

  const parts = stored.split(':');
  if (parts.length !== 6 || parts[0] !== 'kmmsg' || parts[1] !== 'v1') {
    throw new Error('Invalid KnowMe encrypted message envelope.');
  }

  const [, , keyId, ivRaw, tagRaw, ciphertextRaw] = parts;
  const ring = resolveKeyRing(env);
  const key = ring.byId.get(keyId);
  if (!key) {
    throw new Error(`Unknown KnowMe message encryption key id: ${keyId}.`);
  }

  const iv = decode(ivRaw, 'IV');
  const tag = decode(tagRaw, 'authentication tag');
  const ciphertext = decode(ciphertextRaw, 'ciphertext');
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length < 1) {
    throw new Error('Invalid KnowMe encrypted message envelope sizes.');
  }

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(AAD);
  decipher.setAuthTag(tag);

  let payload: SerializedPayload;
  try {
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]).toString('utf8');
    payload = JSON.parse(plaintext) as SerializedPayload;
  } catch {
    throw new Error('KnowMe encrypted message authentication failed.');
  }

  if (
    payload?.v !== 1 ||
    typeof payload.content !== 'string' ||
    (payload.conversationId !== undefined &&
      typeof payload.conversationId !== 'string') ||
    (payload.senderId !== undefined && typeof payload.senderId !== 'string')
  ) {
    throw new Error('Invalid KnowMe encrypted message payload.');
  }

  if (
    payload.conversationId &&
    context.conversationId &&
    payload.conversationId !== context.conversationId
  ) {
    throw new Error('Encrypted message conversation binding mismatch.');
  }
  if (
    payload.senderId &&
    context.senderId &&
    payload.senderId !== context.senderId
  ) {
    throw new Error('Encrypted message sender binding mismatch.');
  }

  return payload.content;
}
