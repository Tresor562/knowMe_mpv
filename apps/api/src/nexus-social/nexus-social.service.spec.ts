import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException
} from '@nestjs/common';
import { NexusSocialService } from './nexus-social.service';

describe('NexusSocialService', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  function createService(overrides: Record<string, unknown> = {}) {
    const prisma = {
      nexusSocialConversation: {
        findUnique: jest.fn(),
        delete: jest.fn(),
        create: jest.fn()
      },
      nexusSocialReply: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn()
      },
      conversation: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      },
      conversationMember: { findUnique: jest.fn() },
      message: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([])
      },
      $transaction: jest.fn()
    };
    Object.assign(prisma, overrides);
    return {
      prisma,
      service: new NexusSocialService(
        prisma as never,
        { emitMessageCreated: jest.fn() } as never,
        { createMany: jest.fn() } as never,
        { record: jest.fn() } as never
      )
    };
  }

  it('fails closed while the social kill switch is disabled', async () => {
    process.env = {
      ...originalEnv,
      NEXUS_INTEGRATION_ENABLED: 'true',
      NEXUS_SOCIAL_ENABLED: 'false'
    };
    const { service } = createService();

    await expect(service.createPrivateConversation('user-123456')).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it('requires an explicit @Nexus mention for a group turn', async () => {
    process.env = {
      ...originalEnv,
      NEXUS_INTEGRATION_ENABLED: 'true',
      NEXUS_SOCIAL_ENABLED: 'true'
    };
    const { service, prisma } = createService();
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conversation-123456',
      isGroup: true,
      members: [
        { userId: 'user-123456', user: { username: 'one', displayName: 'One' } },
        { userId: 'user-654321', user: { username: 'two', displayName: 'Two' } }
      ]
    });
    prisma.nexusSocialConversation.findUnique.mockResolvedValue(null);
    prisma.message.findFirst.mockResolvedValue({
      id: 'message-123456',
      senderId: 'user-123456',
      content: 'Bonjour tout le monde',
      createdAt: new Date()
    });

    await expect(
      service.invoke('user-123456', 'conversation-123456', {
        sourceMessageId: 'message-123456',
        idempotencyKey: 'unit:group:no-mention:123456'
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not let one member invoke Nexus from another member message', async () => {
    process.env = {
      ...originalEnv,
      NEXUS_INTEGRATION_ENABLED: 'true',
      NEXUS_SOCIAL_ENABLED: 'true'
    };
    const { service, prisma } = createService();
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conversation-123456',
      isGroup: true,
      members: [
        { userId: 'user-123456', user: { username: 'one', displayName: 'One' } },
        { userId: 'user-654321', user: { username: 'two', displayName: 'Two' } }
      ]
    });
    prisma.nexusSocialConversation.findUnique.mockResolvedValue(null);
    prisma.message.findFirst.mockResolvedValue({
      id: 'message-123456',
      senderId: 'user-654321',
      content: '@Nexus réponds',
      createdAt: new Date()
    });

    await expect(
      service.invoke('user-123456', 'conversation-123456', {
        sourceMessageId: 'message-123456',
        idempotencyKey: 'unit:group:foreign-source:123456'
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires HTTPS for the Nexus server in production', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      NEXUS_SERVER_URL: 'http://nexus.internal.example'
    };
    const { service } = createService();

    expect(() => (service as unknown as { nexusEndpoint: () => string }).nexusEndpoint())
      .toThrow(ServiceUnavailableException);
  });

  it('rejects Nexus server URLs containing embedded credentials or query strings', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      NEXUS_SERVER_URL: 'https://user:password@nexus.example.com?token=nope'
    };
    const { service } = createService();

    expect(() => (service as unknown as { nexusEndpoint: () => string }).nexusEndpoint())
      .toThrow(ServiceUnavailableException);
  });
});
