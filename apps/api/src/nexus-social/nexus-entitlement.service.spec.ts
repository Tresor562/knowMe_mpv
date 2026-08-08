import { BadRequestException } from '@nestjs/common';
import { NexusEntitlementService } from './nexus-entitlement.service';

describe('NexusEntitlementService', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  function setup() {
    const prisma = {
      nexusAccountLink: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn()
      },
      nexusSocialConversation: { findUnique: jest.fn() },
      nexusSocialReply: { count: jest.fn().mockResolvedValue(0) }
    };
    return { prisma, service: new NexusEntitlementService(prisma as never) };
  }

  it('provides private Nexus to unlinked KnowMe users with an instant-only free baseline', async () => {
    const { service } = setup();
    const result = await service.statusForUser('knowme-user-1');
    expect(result.linked).toBe(false);
    expect(result.plan).toBe('free');
    expect(result.knowMe.modes).toEqual(['instant']);
    expect(result.knowMe.hourlyTurns).toBe(12);
  });

  it('does not allow unlinked users to elevate themselves to Think mode', async () => {
    const { service, prisma } = setup();
    prisma.nexusSocialConversation.findUnique.mockResolvedValue({ ownerUserId: 'knowme-user-1' });
    await expect(service.authorizeConversationTurn('knowme-user-1', 'conv-1', 'think'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces the unlinked hourly private-chat quota', async () => {
    const { service, prisma } = setup();
    prisma.nexusSocialConversation.findUnique.mockResolvedValue({ ownerUserId: 'knowme-user-1' });
    prisma.nexusSocialReply.count.mockResolvedValue(12);
    await expect(service.authorizeConversationTurn('knowme-user-1', 'conv-1', 'instant'))
      .rejects.toMatchObject({ status: 429 });
  });

  it('does not apply private-subscription gating to ordinary group @Nexus turns', async () => {
    const { service, prisma } = setup();
    prisma.nexusSocialConversation.findUnique.mockResolvedValue(null);
    await expect(service.authorizeConversationTurn('knowme-user-1', 'group-1', 'think')).resolves.toBeNull();
    expect(prisma.nexusSocialReply.count).not.toHaveBeenCalled();
  });

  it('consumes a Nexus one-time link server-to-server and persists only minimal link metadata', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      NEXUS_SERVER_URL: 'https://nexus.example.com',
      NEXUS_KNOWME_SHARED_SECRET: '12345678901234567890123456789012'
    };
    const { service, prisma } = setup();
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        linked: true,
        nexusUserId: '11111111-1111-1111-1111-111111111111',
        verifiedAt: new Date().toISOString(),
        entitlement: {
          plan: 'plus', status: 'active',
          capabilities: { knowMePrivateChat: true, knowMeThink: true },
          knowMe: { hourlyTurns: 120, maxContextMessages: 30, maxReplyChars: 24000, modes: ['instant', 'think'] }
        }
      })
    } as Response);

    const result = await service.linkAccount('knowme-user-1', 'abcdefghijklmnop');
    expect(result.plan).toBe('plus');
    expect(prisma.nexusAccountLink.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        knowMeUserId: 'knowme-user-1',
        nexusUserId: '11111111-1111-1111-1111-111111111111',
        lastPlan: 'plus'
      })
    }));
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://nexus.example.com/api/integrations/knowme/entitlements',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('fails stale paid authorization down to linked Free if Nexus entitlement refresh is unavailable', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      NEXUS_SERVER_URL: 'https://nexus.example.com',
      NEXUS_KNOWME_SHARED_SECRET: '12345678901234567890123456789012'
    };
    const { service, prisma } = setup();
    prisma.nexusAccountLink.findUnique.mockResolvedValue({
      knowMeUserId: 'knowme-user-1',
      nexusUserId: '11111111-1111-1111-1111-111111111111',
      lastPlan: 'pro',
      lastStatus: 'active'
    });
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));
    const result = await service.statusForUser('knowme-user-1');
    expect(result.linked).toBe(true);
    expect(result.plan).toBe('free');
    expect(result.knowMe.hourlyTurns).toBe(30);
  });
});
