import { StoriesService } from './stories.service';

/** Story rail counts must be calculated by Postgres, never by slicing 50 rows. */
describe('StoriesService.rail', () => {
  function setup() {
    const prisma = {
      story: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        groupBy: jest.fn(),
        findFirst: jest.fn()
      },
      friendship: { findMany: jest.fn().mockResolvedValue([
        { requesterId: 'viewer', addresseeId: 'friend' }
      ]) },
      creatorFollow: { findMany: jest.fn().mockResolvedValue([]) },
      storyAudienceGrant: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn() }
    };
    const service = new StoriesService(prisma as any, {} as any, {} as any);
    return { service, prisma };
  }

  it('uses identical feed ACL and returns total counts beyond a 50-story page', async () => {
    const { service, prisma } = setup();
    prisma.story.groupBy.mockResolvedValue([
      { authorUserId: 'friend', _count: { _all: 76 }, _max: { createdAt: new Date() } },
      { authorUserId: 'viewer', _count: { _all: 2 }, _max: { createdAt: new Date() } }
    ]);
    prisma.story.findFirst.mockImplementation(async ({ where }: any) => {
      const id = where.AND[1].authorUserId;
      return { id: id + '-latest', authorUserId: id, type: 'PHOTO', assetId: null };
    });
    prisma.user.findMany.mockResolvedValue([
      { id: 'viewer', displayName: 'Me', username: 'me', avatarUrl: null, verificationRequests: [] },
      { id: 'friend', displayName: 'Friend', username: 'friend', avatarUrl: null, verificationRequests: [] }
    ]);
    const result = await service.rail('viewer');
    expect(result.nextOffset).toBeNull();
    expect(result.groups.map(group => [group.story.id, group.count, group.story.viewer.own])).toEqual([
      ['friend-latest', 76, false],
      ['viewer-latest', 2, true]
    ]);
    const filter = prisma.story.groupBy.mock.calls[0][0].where;
    expect(filter.status).toBe('PUBLISHED');
    expect(filter.AND[0].OR).toEqual(expect.arrayContaining([
      { authorUserId: 'viewer' },
      { audience: 'FRIENDS', authorUserId: { in: ['friend'] } }
    ]));
    expect(filter.OR).toEqual([{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }]);
  });

  it('paginates authors, not stories, and never reveals a deleted author', async () => {
    const { service, prisma } = setup();
    prisma.story.groupBy.mockResolvedValue(
      Array.from({ length: 31 }, (_, index) => ({
        authorUserId: 'member' + index,
        _count: { _all: 200 + index },
        _max: { createdAt: new Date() }
      }))
    );
    prisma.story.findFirst.mockImplementation(async ({ where }: any) => ({
      id: 'story-' + where.AND[1].authorUserId,
      authorUserId: where.AND[1].authorUserId,
      type: 'PHOTO'
    }));
    // Member 29 no longer exists; omit its tile.
    prisma.user.findMany.mockResolvedValue(
      Array.from({ length: 29 }, (_, index) => ({
        id: 'member' + index, username: 'person' + index, displayName: 'Person ' + index,
        avatarUrl: null, verificationRequests: []
      }))
    );
    const response = await service.rail('viewer', 30);
    expect(response.nextOffset).toBe(60);
    expect(response.groups).toHaveLength(29);
    expect(prisma.story.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 30, take: 31 })
    );
    expect(response.groups[0].count).toBe(200);
  });
});
