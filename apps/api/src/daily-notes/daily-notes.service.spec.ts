import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { DailyNotesService } from './daily-notes.service';

describe('DailyNotesService', () => {
  const prisma = {
    friendship: { findMany: jest.fn() },
    dailyNote: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn()
    }
  };
  const moderation = { assertAllowed: jest.fn() };
  const service = new DailyNotesService(
    prisma as unknown as PrismaService,
    moderation as unknown as ModerationService
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.friendship.findMany.mockResolvedValue([
      { requesterId: 'me', addresseeId: 'accepted-friend' },
      { requesterId: 'other-friend', addresseeId: 'me' }
    ]);
    prisma.dailyNote.findMany.mockResolvedValue([]);
    prisma.dailyNote.upsert.mockResolvedValue({ userId: 'me', content: 'Bonjour' });
    prisma.dailyNote.deleteMany.mockResolvedValue({ count: 1 });
    moderation.assertAllowed.mockResolvedValue(undefined);
  });

  it('only reads active thoughts belonging to the viewer and accepted friends', async () => {
    await service.list('me');
    expect(prisma.friendship.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: 'me' }, { addresseeId: 'me' }]
      }
    }));
    expect(prisma.dailyNote.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        expiresAt: { gt: expect.any(Date) },
        userId: { in: ['me', 'accepted-friend', 'other-friend'] },
        user: { isSuspended: false }
      }
    }));
  });

  it('rejects empty thoughts rather than writing them', async () => {
    await expect(service.publish('me', '   ')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.dailyNote.upsert).not.toHaveBeenCalled();
  });

  it('replaces the viewer thought with an expiration 24 hours in the future', async () => {
    const before = Date.now();
    await service.publish('me', '  Bonjour  ');
    expect(moderation.assertAllowed).toHaveBeenCalledWith({
      actorId: 'me', action: 'POST_CREATE', content: 'Bonjour'
    });
    const call = prisma.dailyNote.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ userId: 'me' });
    expect(call.create.content).toBe('Bonjour');
    expect(call.update.content).toBe('Bonjour');
    expect(call.update.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 86400000);
    expect(call.update.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 86400000);
  });

  it('only deletes the authenticated account thought', async () => {
    await expect(service.remove('me')).resolves.toEqual({ removed: true });
    expect(prisma.dailyNote.deleteMany).toHaveBeenCalledWith({ where: { userId: 'me' } });
  });
});
