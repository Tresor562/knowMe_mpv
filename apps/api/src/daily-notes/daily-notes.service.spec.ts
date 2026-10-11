import { DailyNotesService } from './daily-notes.service';
import { PrismaService } from '../prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';

describe('DailyNotesService — privacy and expiration', () => {
  const prisma = {
    friendship: { findMany: jest.fn() },
    dailyNote: {
      findMany: jest.fn(), findFirst: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn()
    }
  };
  const moderation = { assertAllowed: jest.fn() };
  const service = new DailyNotesService(
    prisma as unknown as PrismaService,
    moderation as unknown as ModerationService
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.friendship.findMany.mockResolvedValue([]);
    prisma.dailyNote.findMany.mockResolvedValue([]);
    prisma.dailyNote.upsert.mockImplementation(async args => ({ userId: args.where.userId, ...args.create }));
    prisma.dailyNote.deleteMany.mockResolvedValue({ count: 1 });
  });

  it('never requests pending, blocked or strangers notes', async () => {
    prisma.friendship.findMany.mockResolvedValue([
      { requesterId:'me', addresseeId:'friend' },
      { requesterId:'friend2', addresseeId:'me' }
    ]);
    await service.listVisible('me');
    expect(prisma.friendship.findMany).toHaveBeenCalledWith({
      where: { status: 'ACCEPTED', OR: [{requesterId:'me'}, {addresseeId:'me'}] },
      select: { requesterId:true, addresseeId:true },
      take: 250
    });
    expect(prisma.dailyNote.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId: { in: ['me', 'friend', 'friend2'] },
        expiresAt: { gt: expect.any(Date) },
        user: { isSuspended: false }
      },
      take:100
    }));
  });

  it('provides only the requested person’s own active note', async () => {
    prisma.dailyNote.findFirst.mockResolvedValue(null);
    await expect(service.mine('me')).resolves.toBeNull();
    expect(prisma.dailyNote.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {userId:'me', expiresAt:{gt:expect.any(Date)}}
    }));
  });

  it('refreshes expiration by exactly one day, storing a single text note', async () => {
    await service.upsert('me',{content:'  Bonjour 🌻  '});
    const args=prisma.dailyNote.upsert.mock.calls[0]?.[0];
    expect(args).toBeDefined();
    expect(args.where).toEqual({userId:'me'});
    expect(args.create.content).toBe('Bonjour 🌻');
    expect(args.update.content).toBe('Bonjour 🌻');
    const window=Date.parse(args.create.expiresAt)-Date.now();
    expect(window).toBeGreaterThan(86_399_000);
    expect(window).toBeLessThanOrEqual(86_400_000);
    expect(moderation.assertAllowed).toHaveBeenCalledWith({
      actorId:'me', action:'DAILY_NOTE', content:'Bonjour 🌻'
    });
  });

  it('removes only the authenticated account’s note', async () => {
    await expect(service.remove('me')).resolves.toEqual({deleted:true});
    expect(prisma.dailyNote.deleteMany).toHaveBeenCalledWith({where:{userId:'me'}});
  });
});
