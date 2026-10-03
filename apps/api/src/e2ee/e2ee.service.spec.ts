import { E2eeService } from './e2ee.service';
import { E2EE_PROTOCOL } from './e2ee.domain';

const keyA = Buffer.alloc(32, 1).toString('base64');
const keyB = Buffer.alloc(32, 2).toString('base64');
const signature = Buffer.alloc(64, 3).toString('base64');

function registration(identityKey = keyA) {
  return {
    protocol: E2EE_PROTOCOL,
    registrationId: 7,
    identityKey,
    signedPreKeyId: 9,
    signedPreKey: keyA,
    signedPreKeySignature: signature,
    oneTimePreKeys: [{ keyId: 11, publicKey: keyB }]
  };
}

describe('E2eeService', () => {
  it('fails closed when an existing session attempts to replace its identity key', async () => {
    const tx = {
      e2eeDevice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'device-1',
          identityKey: keyA,
          revokedAt: null
        })
      }
    };
    const prisma = {
      authSession: {
        findFirst: jest.fn().mockResolvedValue({ id: 'session-1' })
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx)
      )
    };
    const audit = { record: jest.fn() };
    const service = new E2eeService(
      prisma as never,
      audit as never,
      { create: jest.fn() } as never
    );

    await expect(
      service.register('user-1', 'session-1', registration(keyB))
    ).rejects.toThrow('E2EE_IDENTITY_KEY_REPLACEMENT_REQUIRES_NEW_SESSION');

    expect(audit.record).not.toHaveBeenCalled();
  });

  it('consumes a one-time prekey when an authorized conversation member claims a bundle', async () => {
    const tx = {
      e2eeDevice: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'device-2',
            protocol: E2EE_PROTOCOL,
            registrationId: 15,
            identityKey: keyA,
            signedPreKeyId: 16,
            signedPreKey: keyB,
            signedPreKeySignature: signature,
            createdAt: new Date('2026-10-03T18:00:00.000Z')
          }
        ])
      },
      e2eeOneTimePreKey: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'prekey-1',
          deviceId: 'device-2',
          keyId: 17,
          publicKey: keyA,
          claimedAt: null
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      }
    };
    const transactionOptions: unknown[] = [];
    const prisma = {
      conversationMember: {
        findUnique: jest.fn().mockResolvedValue({ id: 'membership' })
      },
      $transaction: jest.fn(
        async (
          callback: (client: typeof tx) => unknown,
          options: unknown
        ) => {
          transactionOptions.push(options);
          return callback(tx);
        }
      )
    };
    const service = new E2eeService(
      prisma as never,
      { record: jest.fn() } as never,
      { create: jest.fn() } as never
    );

    const result = await service.claimConversationBundles(
      'alice',
      'conversation-1',
      'bob'
    );

    expect(result.bundles).toHaveLength(1);
    expect(result.bundles[0]?.oneTimePreKey).toEqual({
      keyId: 17,
      publicKey: keyA
    });
    expect(tx.e2eeOneTimePreKey.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prekey-1', claimedAt: null },
        data: { claimedAt: expect.any(Date) }
      })
    );
    expect(transactionOptions[0]).toEqual(
      expect.objectContaining({ isolationLevel: 'Serializable' })
    );
  });

  it('does not return a prekey when a competing claim consumed it first', async () => {
    const tx = {
      e2eeDevice: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'device-3',
            protocol: E2EE_PROTOCOL,
            registrationId: 21,
            identityKey: keyA,
            signedPreKeyId: 22,
            signedPreKey: keyB,
            signedPreKeySignature: signature,
            createdAt: new Date('2026-10-03T18:00:00.000Z')
          }
        ])
      },
      e2eeOneTimePreKey: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'prekey-race',
          deviceId: 'device-3',
          keyId: 23,
          publicKey: keyA,
          claimedAt: null
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      }
    };
    const prisma = {
      conversationMember: {
        findUnique: jest.fn().mockResolvedValue({ id: 'membership' })
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx)
      )
    };
    const service = new E2eeService(
      prisma as never,
      { record: jest.fn() } as never,
      { create: jest.fn() } as never
    );

    const result = await service.claimConversationBundles(
      'alice',
      'conversation-1',
      'bob'
    );

    expect(result.bundles[0]?.oneTimePreKey).toBeNull();
  });
});
