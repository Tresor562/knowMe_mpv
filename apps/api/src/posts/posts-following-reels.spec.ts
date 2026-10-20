import { ReelsFeedService } from './reels-feed.service';

describe('Reels subscribed video feed', () => {
  const setup = (subscriptions: string[]) => {
    const prisma = {
      creatorFollow: { findMany: jest.fn().mockResolvedValue(
        subscriptions.map(creatorId => ({ creatorId }))
      ) },
      post: { findMany: jest.fn().mockResolvedValue([]) }
    };
    const service = new ReelsFeedService(prisma as never, {} as never);
    return { prisma, service };
  };

  it('returns no public videos when a viewer has no creator subscriptions', async () => {
    const { prisma, service } = setup([]);
    await expect(service.following('viewer')).resolves.toEqual([]);
    expect(prisma.creatorFollow.findMany).toHaveBeenCalledWith({
      where: { followerId: 'viewer' }, select: { creatorId: true }
    });
    expect(prisma.post.findMany).not.toHaveBeenCalled();
  });

  it('filters creators before applying its video pagination cursor', async () => {
    const { prisma, service } = setup(['one', 'two']);
    await service.following('viewer', 'previous-video');
    expect(prisma.post.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        media: { some: { mimeType: 'video/mp4' } },
        authorId: { in: ['one', 'two'] }
      },
      take: 20,
      skip: 1,
      cursor: { id: 'previous-video' }
    }));
  });
});
