import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConversationPinsService } from './conversation-pins.service';

describe('ConversationPinsService', () => {
  const makePrisma = () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      conversationPin: {
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn()
      }
    };
    const prisma = {
      conversationPin: {
        findMany: jest.fn(),
        deleteMany: jest.fn()
      },
      conversationMember: {
        findMany: jest.fn(),
        findUnique: jest.fn()
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx))
    };
    return { prisma, tx };
  };

  it('removes stale pins instead of treating a pin as authorization', async () => {
    const { prisma } = makePrisma();
    prisma.conversationPin.findMany.mockResolvedValue([
      { userId: 'u1', conversationId: 'allowed', pinnedAt: new Date('2026-08-16T00:00:00Z') },
      { userId: 'u1', conversationId: 'stale', pinnedAt: new Date('2026-08-15T00:00:00Z') }
    ]);
    prisma.conversationMember.findMany.mockResolvedValue([{ conversationId: 'allowed' }]);
    prisma.conversationPin.deleteMany.mockResolvedValue({ count: 1 });

    const service = new ConversationPinsService(prisma as never);
    const result = await service.list('u1');

    expect(result.items).toHaveLength(1);
    expect(result.items[0].conversationId).toBe('allowed');
    expect(result.remaining).toBe(4);
    expect(result.canPinMore).toBe(true);
    expect(prisma.conversationPin.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', conversationId: { in: ['stale'] } }
    });
  });

  it('derives full-capacity metadata only from currently accessible pins', async () => {
    const { prisma } = makePrisma();
    prisma.conversationPin.findMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, index) => ({
        userId: 'u1',
        conversationId: `c${index + 1}`,
        pinnedAt: new Date(`2026-08-16T00:00:0${index}Z`)
      }))
    );
    prisma.conversationMember.findMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, index) => ({ conversationId: `c${index + 1}` }))
    );

    const service = new ConversationPinsService(prisma as never);
    const result = await service.list('u1');

    expect(result.limit).toBe(5);
    expect(result.remaining).toBe(0);
    expect(result.canPinMore).toBe(false);
    expect(result.items).toHaveLength(5);
  });

  it('rejects pinning a conversation the caller cannot currently access', async () => {
    const { prisma } = makePrisma();
    prisma.conversationMember.findUnique.mockResolvedValue(null);
    const service = new ConversationPinsService(prisma as never);

    await expect(service.pin('u1', 'c1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('keeps pinning idempotent', async () => {
    const { prisma, tx } = makePrisma();
    prisma.conversationMember.findUnique.mockResolvedValue({ id: 'm1' });
    tx.conversationPin.findUnique.mockResolvedValue({
      userId: 'u1', conversationId: 'c1', pinnedAt: new Date('2026-08-16T00:00:00Z')
    });
    const service = new ConversationPinsService(prisma as never);

    await service.pin('u1', 'c1');

    expect(tx.conversationPin.count).not.toHaveBeenCalled();
    expect(tx.conversationPin.create).not.toHaveBeenCalled();
  });

  it('enforces the bounded five-pin limit under the serialized user transaction', async () => {
    const { prisma, tx } = makePrisma();
    prisma.conversationMember.findUnique.mockResolvedValue({ id: 'm1' });
    tx.conversationPin.findUnique.mockResolvedValue(null);
    tx.conversationPin.count.mockResolvedValue(5);
    const service = new ConversationPinsService(prisma as never);

    await expect(service.pin('u1', 'c6')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.conversationPin.create).not.toHaveBeenCalled();
  });
});
