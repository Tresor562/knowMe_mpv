import { ForbiddenException, HttpException } from '@nestjs/common';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ModerationService } from './moderation.service';

describe('ModerationService', () => {
  const prismaMock = {
    abuseEvent: {
      count: jest.fn(),
      create: jest.fn()
    },
    moderationAction: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findManyActions: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    user: {
      findUnique: jest.fn()
    }
  };
  const auditMock = { record: jest.fn() };

  let service: ModerationService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.moderationAction.findMany.mockResolvedValue([]);
    prismaMock.abuseEvent.count.mockResolvedValue(0);
    prismaMock.abuseEvent.create.mockResolvedValue({ id: 'event_1' });
    service = new ModerationService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService
    );
  });

  it('blocks duplicate post content without storing the raw content', async () => {
    prismaMock.abuseEvent.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);

    await expect(
      service.assertAllowed({
        actorId: 'user_1',
        action: 'POST_CREATE',
        content: '  Même publication  '
      })
    ).rejects.toBeInstanceOf(HttpException);

    expect(prismaMock.abuseEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'user_1',
        action: 'POST_CREATE',
        decision: 'BLOCKED',
        reasonCode: 'DUPLICATE_CONTENT',
        contentHash: expect.stringMatching(/^[a-f0-9]{64}$/)
      })
    });
    expect(
      JSON.stringify(prismaMock.abuseEvent.create.mock.calls)
    ).not.toContain('Même publication');
  });

  it('enforces an active content lock', async () => {
    prismaMock.moderationAction.findMany.mockResolvedValue([
      { action: 'CONTENT_LOCK' }
    ]);

    await expect(
      service.assertAllowed({
        actorId: 'user_2',
        action: 'MESSAGE_SEND',
        content: 'Bonjour'
      })
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.abuseEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        decision: 'BLOCKED',
        reasonCode: 'CONTENT_LOCK'
      })
    });
  });

  it('creates and audits an administrative moderation action', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user_3' });
    prismaMock.moderationAction.findFirst.mockResolvedValue(null);
    prismaMock.moderationAction.create.mockResolvedValue({
      id: 'action_1',
      targetId: 'user_3',
      action: 'RATE_LIMIT',
      expiresAt: null
    });

    const result = await service.applyAction('moderator_1', {
      targetType: 'USER',
      targetId: 'user_3',
      action: 'RATE_LIMIT',
      reason: 'Activité automatisée répétée'
    });

    expect(result).toEqual(expect.objectContaining({ id: 'action_1' }));
    expect(auditMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'moderator_1',
        action: 'MODERATION_ACTION_APPLY',
        targetAccountId: 'user_3'
      })
    );
  });
});
