import {
  assertPublicKeyMaterial,
  E2EE_PROTOCOL,
  e2eeKeyDirectoryPolicy
} from './e2ee.domain';

const key = Buffer.alloc(32, 7).toString('base64');

describe('KnowMe E2EE key directory policy', () => {
  it('accepts bounded base64 public key material', () => {
    expect(assertPublicKeyMaterial(key, 'identityKey')).toBe(key);
  });

  it('rejects malformed or tiny key material', () => {
    expect(() => assertPublicKeyMaterial('not base64 !!!', 'identityKey')).toThrow(
      /base64/
    );
    expect(() =>
      assertPublicKeyMaterial(Buffer.alloc(8, 1).toString('base64'), 'identityKey')
    ).toThrow(/base64 public key material|decoded size/);
  });

  it('keeps private keys and server-side Secret Chat decryption out of the contract', () => {
    const policy = e2eeKeyDirectoryPolicy();

    expect(policy.protocol).toBe(E2EE_PROTOCOL);
    expect(policy.serverStoresPrivateKeys).toBe(false);
    expect(policy.serverCanDecryptSecretChatPayloads).toBe(false);
    expect(policy.identityKeyReplacementInPlace).toBe(false);
    expect(policy.oneTimePreKeysConsumedAtMostOnce).toBe(true);
    expect(policy.bundleClaimsRequireConversationMembership).toBe(true);
    expect(policy.privateKeysMustUsePlatformSecureStorage).toBe(true);
  });
});
