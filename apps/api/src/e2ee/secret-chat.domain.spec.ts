import {
  assertOpaqueCiphertext,
  secretChatServerPolicy
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

  it('forbids server plaintext storage and decryption by contract', () => {
    const policy = secretChatServerPolicy();
    expect(policy.serverStoresPlaintext).toBe(false);
    expect(policy.serverDecryptsCiphertext).toBe(false);
    expect(policy.exactActiveDeviceFanoutRequired).toBe(true);
    expect(policy.cloudMessageEndpointBlockedForSecretConversations).toBe(true);
    expect(policy.serverModeratesSecretMessagePlaintext).toBe(false);
  });
});
