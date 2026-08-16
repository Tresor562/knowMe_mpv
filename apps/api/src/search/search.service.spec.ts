import { SearchService } from './search.service';

describe('SearchService', () => {
  const now = new Date('2026-08-16T00:00:00.000Z');

  function createService() {
    const prisma = {
      message: { findMany: jest.fn().mockResolvedValue([]) },
      post: { findMany: jest.fn().mockResolvedValue([]) },
      challenge: { findMany: jest.fn().mockResolvedValue([]) },
      conversation: { findMany: jest.fn().mockResolvedValue([]) }
    };
    return {
      prisma,
      service: new SearchService(prisma as never)
    };
  }

  it('does not search for queries shorter than two characters', async () => {
    const { prisma, service } = createService();

    await expect(service.search('user-1', ' a ')).resolves.toEqual({
      query: 'a',
      items: [],
      nextCursor: null
    });
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });

  it('scopes every private source to the authenticated user', async () => {
    const { prisma, service } = createService();

    await service.search('user-1', 'hello', 25);

    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          conversation: { members: { some: { userId: 'user-1' } } }
        })
      })
    );
    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ authorId: 'user-1' })
      })
    );
    expect(prisma.challenge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ creatorId: 'user-1' })
      })
    );
    expect(prisma.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          members: { some: { userId: 'user-1' } }
        })
      })
    );
  });

  it('merges authorized results deterministically and returns bounded snippets', async () => {
    const { prisma, service } = createService();
    prisma.message.findMany.mockResolvedValue([
      {
        id: 'm1',
        conversationId: 'c1',
        content: `before ${'x'.repeat(220)} hello after`,
        createdAt: now
      }
    ]);
    prisma.post.findMany.mockResolvedValue([
      {
        id: 'p1',
        content: 'hello from my post',
        updatedAt: new Date(now.getTime() - 1000)
      }
    ]);

    const result = await service.search('user-1', 'hello', 20);

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      kind: 'MESSAGE',
      id: 'm1',
      route: '/messages/c1?message=m1'
    });
    expect(result.items[0]?.snippet.length).toBeLessThanOrEqual(182);
    expect(result.items[1]).toMatchObject({ kind: 'POST', id: 'p1' });
  });

  it('returns an opaque query-bound cursor and applies its global boundary', async () => {
    const { prisma, service } = createService();
    prisma.message.findMany.mockResolvedValue([
      {
        id: 'm1',
        conversationId: 'c1',
        content: 'hello newest',
        createdAt: now
      },
      {
        id: 'm2',
        conversationId: 'c1',
        content: 'hello older',
        createdAt: new Date(now.getTime() - 1000)
      }
    ]);

    const first = await service.search('user-1', 'Hello', 1);
    expect(first.nextCursor).toEqual(expect.any(String));
    expect(first.nextCursor).not.toContain('m1');

    prisma.message.findMany.mockResolvedValue([]);
    await service.search('user-1', 'hello', 1, first.nextCursor ?? undefined);

    expect(prisma.message.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [expect.objectContaining({ OR: expect.any(Array) })]
        })
      })
    );
  });

  it('rejects malformed cursors and cursors issued for another query', async () => {
    const { prisma, service } = createService();
    prisma.message.findMany.mockResolvedValue([
      {
        id: 'm1',
        conversationId: 'c1',
        content: 'hello first',
        createdAt: now
      },
      {
        id: 'm2',
        conversationId: 'c1',
        content: 'hello second',
        createdAt: new Date(now.getTime() - 1000)
      }
    ]);

    await expect(service.search('user-1', 'hello', 10, 'broken')).rejects.toThrow(
      'SEARCH_CURSOR_INVALID'
    );

    const first = await service.search('user-1', 'hello', 1);
    await expect(
      service.search('user-1', 'different', 1, first.nextCursor ?? undefined)
    ).rejects.toThrow('SEARCH_CURSOR_INVALID');
  });
});
