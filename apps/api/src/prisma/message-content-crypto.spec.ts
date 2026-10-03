import {
  decryptMessageContent,
  encryptMessageContent,
  isEncryptedMessageContent
} from './message-content-crypto';

const keyA = Buffer.alloc(32, 7).toString('base64');
const keyB = Buffer.alloc(32, 9).toString('base64');

describe('KnowMe message content crypto', () => {
  it('encrypts with AES-GCM and round-trips without storing plaintext', () => {
    const env = {
      KNOWME_MESSAGE_ENCRYPTION_KEY_ID: 'k1',
      KNOWME_MESSAGE_ENCRYPTION_KEY: keyA
    };
    const encrypted = encryptMessageContent(
      'message très privé',
      { conversationId: 'conv-1', senderId: 'user-1' },
      env
    );

    expect(isEncryptedMessageContent(encrypted)).toBe(true);
    expect(encrypted).not.toContain('message très privé');
    expect(
      decryptMessageContent(
        encrypted,
        { conversationId: 'conv-1', senderId: 'user-1' },
        env
      )
    ).toBe('message très privé');
  });

  it('rejects tampered ciphertext', () => {
    const env = {
      KNOWME_MESSAGE_ENCRYPTION_KEY_ID: 'k1',
      KNOWME_MESSAGE_ENCRYPTION_KEY: keyA
    };
    const encrypted = encryptMessageContent('secret', {}, env);
    const last = encrypted.at(-1);
    const tampered = `${encrypted.slice(0, -1)}${last === 'A' ? 'B' : 'A'}`;

    expect(() => decryptMessageContent(tampered, {}, env)).toThrow(
      'authentication failed'
    );
  });

  it('binds encrypted content to the conversation and sender when available', () => {
    const env = {
      KNOWME_MESSAGE_ENCRYPTION_KEY_ID: 'k1',
      KNOWME_MESSAGE_ENCRYPTION_KEY: keyA
    };
    const encrypted = encryptMessageContent(
      'secret',
      { conversationId: 'conv-1', senderId: 'user-1' },
      env
    );

    expect(() =>
      decryptMessageContent(
        encrypted,
        { conversationId: 'conv-2', senderId: 'user-1' },
        env
      )
    ).toThrow('conversation binding mismatch');
    expect(() =>
      decryptMessageContent(
        encrypted,
        { conversationId: 'conv-1', senderId: 'user-2' },
        env
      )
    ).toThrow('sender binding mismatch');
  });

  it('decrypts a prior key after rotation', () => {
    const oldEnv = {
      KNOWME_MESSAGE_ENCRYPTION_KEY_ID: 'old',
      KNOWME_MESSAGE_ENCRYPTION_KEY: keyA
    };
    const encrypted = encryptMessageContent('before rotation', {}, oldEnv);
    const rotatedEnv = {
      KNOWME_MESSAGE_ENCRYPTION_KEY_ID: 'new',
      KNOWME_MESSAGE_ENCRYPTION_KEY: keyB,
      KNOWME_MESSAGE_ENCRYPTION_PREVIOUS_KEYS_JSON: JSON.stringify([
        { id: 'old', key: keyA }
      ])
    };

    expect(decryptMessageContent(encrypted, {}, rotatedEnv)).toBe(
      'before rotation'
    );
  });

  it('uses a domain-separated JWT-derived key when a dedicated key is absent', () => {
    const env = {
      JWT_SECRET: 'this-is-a-long-production-like-jwt-secret-for-tests'
    };
    const encrypted = encryptMessageContent('derived', {}, env);

    expect(decryptMessageContent(encrypted, {}, env)).toBe('derived');
  });

  it('keeps legacy plaintext readable during migration', () => {
    expect(decryptMessageContent('legacy plaintext', {}, {})).toBe(
      'legacy plaintext'
    );
  });
});
