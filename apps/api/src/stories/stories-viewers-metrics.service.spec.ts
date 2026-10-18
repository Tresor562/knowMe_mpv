import { StoriesService } from './stories.service';

describe('StoriesService.viewers — complete private owner metrics', () => {
  function setup(owner = true) {
    const prisma = {
      story: {
        findFirst: jest.fn().mockResolvedValue(owner ? {
          id: 'story-1', authorUserId: 'author', status: 'PUBLISHED'
        } : null)
      },
      storyView: {
        findMany: jest.fn(),
        aggregate: jest.fn(),
        count: jest.fn()
      },
      storyReaction: { count: jest.fn() },
      storyReply: { count: jest.fn() },
      user: { findMany: jest.fn() }
    };
    const service = new StoriesService(prisma as any, {} as any, {} as any);
    return { prisma, service };
  }

  it('calculates all metrics across the entire audience, not the latest 500', async () => {
    const { prisma, service } = setup();
    const recent = [
      {
        id: 'v1', storyId: 'story-1', viewerUserId: 'member-1',
        lastViewedAt: new Date('2026-10-18T12:00:00Z'),
        viewCount: 2, completionBps: 10000, screenshotAt: null
      },
      {
        id: 'v2', storyId: 'story-1', viewerUserId: 'member-2',
        lastViewedAt: new Date('2026-10-18T11:00:00Z'),
        viewCount: 4, completionBps: 3000, screenshotAt: new Date()
      }
    ];
    prisma.storyView.findMany.mockResolvedValue(recent);
    prisma.storyView.aggregate.mockResolvedValue({
      _count: { _all: 621 },
      _sum: { viewCount: 920, completionBps: 4_968_000 }
    });
    prisma.storyView.count.mockResolvedValue(83);
    prisma.storyReaction.count.mockResolvedValue(430);
    prisma.storyReply.count.mockResolvedValue(56);
    prisma.user.findMany.mockResolvedValue([
      { id: 'member-1', username: 'first', displayName: 'First',
        avatarUrl: null, verificationRequests: [] }
      // member-2 can be deleted/unavailable without revealing account details
    ]);

    const result = await service.viewers('author', 'story-1');

    expect(result).toMatchObject({
      uniqueViewers: 621,
      totalViews: 920,
      averageCompletionBps: 8000,
      screenshots: 83,
      reactions: 430,
      replies: 56,
      viewersTruncated: true
    });
    expect(result.viewers).toHaveLength(2);
    expect(result.viewers[0].user?.username).toBe('first');
    expect(result.viewers[1].user).toBeNull();

    expect(prisma.storyView.aggregate).toHaveBeenCalledWith({
      where: { storyId: 'story-1' },
      _count: { _all: true },
      _sum: { viewCount: true, completionBps: true }
    });
    expect(prisma.storyView.findMany).toHaveBeenCalledWith({
      where: { storyId: 'story-1' },
      orderBy: [{ lastViewedAt: 'desc' }, { id: 'desc' }],
      take: 500
    });
    expect(prisma.storyView.count).toHaveBeenCalledWith({
      where: { storyId: 'story-1', screenshotAt: { not: null } }
    });
    expect(prisma.storyReaction.count).toHaveBeenCalledWith({
      where: { storyId: 'story-1' }
    });
  });

  it('returns zeros and avoids a useless identity query for empty audiences', async () => {
    const { prisma, service } = setup();
    prisma.storyView.findMany.mockResolvedValue([]);
    prisma.storyView.aggregate.mockResolvedValue({
      _count: { _all: 0 }, _sum: { viewCount: null, completionBps: null }
    });
    prisma.storyView.count.mockResolvedValue(0);
    prisma.storyReaction.count.mockResolvedValue(0);
    prisma.storyReply.count.mockResolvedValue(0);

    const result = await service.viewers('author', 'story-1');
    expect(result).toMatchObject({
      uniqueViewers: 0, totalViews: 0, averageCompletionBps: 0,
      screenshots: 0, viewersTruncated: false, viewers: []
    });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('rejects non-owner access before any audience statistics query', async () => {
    const { prisma, service } = setup(false);
    await expect(service.viewers('stranger', 'story-1')).rejects.toMatchObject({
      response: { code: 'STORY_NOT_FOUND' }
    });
    expect(prisma.storyView.findMany).not.toHaveBeenCalled();
    expect(prisma.storyView.aggregate).not.toHaveBeenCalled();
    expect(prisma.storyReaction.count).not.toHaveBeenCalled();
  });
});
