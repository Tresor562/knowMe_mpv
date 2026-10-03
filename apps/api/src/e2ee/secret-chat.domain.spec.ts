import {
  assertOpaqueCiphertext,
  assertSecretEnvelopeBatchSize,
  secretChatServerPolicy,
  SECRET_MESSAGE_MAX_CIPHERTEXT_BYTES
} from './secret-chat.domain';

describe('Secret Chat server-blind policy', () => {
  it('accepts bounded opaque ciphertext without interpreting it', () => {
    const ciphertext = Buffer.alloc(64, 7).toString('base64');
    expect(assertOpaqueCiphertext(ciphertext)).toBe(ciphertext);
  });

  it('rejects malformed or tiny ciphertext', () => {
    expect(() => assertOpaqueCiphertext('plain text')).toThrow();
    expect(() =>
      assertOpaqueCiphertext(Buffer.alloc(4, 1).toString('base64'))
    ).toThrow();
  });

  it('caps aggregate ciphertext amplification across recipient devices', () => {
    const chunk = Buffer.alloc(128 * 1024, 5).toString('base64');
    expect(
      assertSecretEnvelopeBatchSize([
        { ciphertext: chunk },
        { ciphertext: chunk }
      ])
    ).toBe(256 * 1024);

    const oversized = Buffer.alloc(
      SECRET_MESSAGE_MAX_CIPHERTEXT_BYTES + 1,
      7
    ).toString('base64');
    expect(() =>
      assertSecretEnvelopeBatchSize([{ ciphertext: oversized }])
    ).toThrow('SECRET_MESSAGE_BATCH_TOO_LARGE');
  });

  it('forbids server plaintext storage and decryption by contract', () => {
    const policy = secretChatServerPolicy();
    expect(policy.serverStoresPlaintext).toBe(false);
    expect(policy.serverDecryptsCiphertext).toBe(false);
    expect(policy.exactActiveDeviceFanoutRequired).toBe(true);
    expect(policy.cloudMessageEndpointBlockedForSecretConversations).toBe(true);
    expect(policy.serverModeratesSecretMessagePlaintext).toBe(false);
  });
});
