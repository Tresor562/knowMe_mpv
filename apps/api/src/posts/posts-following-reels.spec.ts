import { ReelsFeedService } from './reels-feed.service';

describe('Reels subscribed video feed', () => {
  const setup = (subscriptions: string[]) => {
    const prisma = {
      creatorFollow: { findMany: jest.fn().mockResolvedValue(
        subscriptions.map(creatorId => ({ creatorId }))
      ) },
      post: { findMany: jest.fn().mockResolvedValue([]) }
    };
    const service = new ReelsFeedService(prisma as never, {} as never, {} as never);
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

  it('returns only viewer-scoped like states, capped and validated', async () => {
    const prisma = {
      postLike: { findMany: jest.fn().mockResolvedValue([{ postId: 'p1' }]) }
    };
    const reels = new ReelsFeedService(prisma as never, {} as never, {} as never);
    const result = await reels.likeStates('viewer', 'p1,p2,p1,not?valid');
    expect(result).toEqual({ likedPostIds: ['p1'] });
    expect(prisma.postLike.findMany).toHaveBeenCalledWith({
      where: { userId: 'viewer', postId: { in: ['p1', 'p2'] } },
      select: { postId: true }
    });
  });

  it('uses a server count after toggling a reaction', async () => {
    const prisma = { postLike: { count: jest.fn().mockResolvedValue(42) } };
    const posts = { toggleLike: jest.fn().mockResolvedValue({ liked: false }) };
    const reels = new ReelsFeedService(prisma as never, posts as never, {} as never);
    await expect(reels.toggleLike('viewer', 'p1')).resolves.toEqual({
      liked: false, count: 42
    });
    expect(posts.toggleLike).toHaveBeenCalledWith('viewer', 'p1');
    expect(prisma.postLike.count).toHaveBeenCalledWith({ where: { postId: 'p1' } });
  });


  it('resolves subscriptions from the author ID, not their username', async () => {
    const prisma = { creatorProfile: { findUnique: jest.fn().mockResolvedValue({ slug:'real-creator-slug' }) } };
    const creators = {
      followStatus: jest.fn().mockResolvedValue({ following:true, isOwner:false }),
      follow: jest.fn().mockResolvedValue({ following:true, replayed:false })
    };
    const reels = new ReelsFeedService(prisma as never, {} as never, creators as never);
    await expect(reels.creatorFollowStatus('viewer', 'author-id')).resolves.toEqual({
      following:true, isOwner:false
    });
    await expect(reels.creatorFollow('viewer', 'author-id', true)).resolves.toEqual({
      following:true, replayed:false
    });
    expect(prisma.creatorProfile.findUnique).toHaveBeenCalledWith({
      where:{userId:'author-id'}, select:{slug:true}
    });
    expect(creators.followStatus).toHaveBeenCalledWith('viewer', 'real-creator-slug');
    expect(creators.follow).toHaveBeenCalledWith('viewer', 'real-creator-slug');
  });

});
