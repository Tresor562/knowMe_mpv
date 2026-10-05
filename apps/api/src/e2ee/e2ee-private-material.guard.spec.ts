import {
  E2eePrivateMaterialGuard,
  e2eeContainsForbiddenPrivateMaterial
} from './e2ee-private-material.guard';

describe('E2eePrivateMaterialGuard', () => {
  it('rejects common private-key and ratchet-state fields recursively', () => {
    expect(
      e2eeContainsForbiddenPrivateMaterial({
        identityKey: 'public',
        nested: { privateKey: 'must-never-leave-device' }
      })
    ).toBe(true);
    expect(
      e2eeContainsForbiddenPrivateMaterial({
        envelopes: [{ root_key: 'ratchet-secret' }]
      })
    ).toBe(true);
  });

  it('allows public key bundles and opaque ciphertext', () => {
    expect(
      e2eeContainsForbiddenPrivateMaterial({
        identityKey: 'public',
        signedPreKey: 'public',
        signedPreKeySignature: 'signature',
        oneTimePreKeys: [{ keyId: 1, publicKey: 'public' }],
        ciphertext: 'opaque'
      })
    ).toBe(false);
  });

  it('fails an HTTP request before DTO sanitization can discard private material', () => {
    const guard = new E2eePrivateMaterialGuard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          body: { privateKey: 'secret' }
        })
      })
    };

    expect(() => guard.canActivate(context as never)).toThrow(
      'E2EE_PRIVATE_KEY_MATERIAL_FORBIDDEN'
    );
  });
});
