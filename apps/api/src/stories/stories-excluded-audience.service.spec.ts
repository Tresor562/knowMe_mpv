import { ForbiddenException } from '@nestjs/common';
import { StoriesService } from './stories.service';

describe('Stories excluded audience and viewer reactions', () => {
  const publicStory = {
    id: 'story1', authorUserId: 'author', status: 'PUBLISHED',
    startsAt: new Date('2026-10-21T10:00:00Z'), expiresAt: null,
    pinnedAt: null, audience: 'PUBLIC'
  };

  function setup() {
    const tx = {
      story: { create: jest.fn().mockResolvedValue(publicStory) },
      storyAudienceGrant: { createMany: jest.fn().mockResolvedValue({count: 1}) }
    };
    const prisma = {
      user: {
        count: jest.fn().mockImplementation(async ({where}: {where: {id: {in: string[]}}}) => where.id.in.length),
        findMany: jest.fn().mockResolvedValue([])
      },
      story: {
        findUnique: jest.fn().mockResolvedValue(publicStory),
        findFirst: jest.fn().mockResolvedValue(publicStory)
      },
      storyAudienceGrant: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([])
      },
      friendship: {findMany: jest.fn().mockResolvedValue([])},
      creatorFollow: {findMany: jest.fn().mockResolvedValue([])},
      storyView: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({_count:{_all:0},_sum:{viewCount:0,completionBps:0}}),
        count: jest.fn().mockResolvedValue(0)
      },
      storyReaction: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([])
      },
      storyReply: {count: jest.fn().mockResolvedValue(0)},
      $transaction: jest.fn().mockImplementation(async (fn: (db: typeof tx) => Promise<unknown>) => fn(tx))
    };
    const entitlements = {hasAll: jest.fn().mockResolvedValue(false)};
    const audit = {record: jest.fn().mockResolvedValue(null)};
    const svc = new StoriesService(prisma as any, entitlements as any, audit as any);
    return {prisma,entitlements,audit,tx,svc};
  }

  it('denies direct and media-gated access to explicitly excluded viewers even on PUBLIC Stories', async () => {
    const {prisma,svc} = setup();
    prisma.storyAudienceGrant.findUnique.mockResolvedValue({
      storyId: 'story1', targetUserId: 'excluded', allowed: false
    });
    await expect(svc.get('excluded','story1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('never excludes the owner from their own Story', async () => {
    const {prisma,svc} = setup();
    jest.spyOn(svc as any,'serialize').mockImplementation(async () => publicStory);
    await expect(svc.get('author','story1')).resolves.toEqual(publicStory);
    expect(prisma.storyAudienceGrant.findUnique).not.toHaveBeenCalled();
  });

  it('omits denied IDs from feed/rail ACL independently of PUBLIC or friend grants', async () => {
    const {prisma,svc} = setup();
    prisma.storyAudienceGrant.findMany
      .mockResolvedValueOnce([{storyId:'allowed-story'}])
      .mockResolvedValueOnce([{storyId:'denied-story'}]);
    const where = await (svc as any).storyFeedWhere('viewer',new Date());
    expect(where.AND[1]).toEqual({id:{notIn:['denied-story']}});
    expect(JSON.stringify(where.AND[0])).toContain('allowed-story');
  });

  it('persists excluded accounts as false grants, never overriding them with CUSTOM includes', async () => {
    const {prisma,tx,svc} = setup();
    jest.spyOn(svc as any,'hydrate').mockResolvedValue(publicStory);
    await svc.create('author',{
      type:'TEXT', caption:'Salut', audience:'CUSTOM',
      audienceUserIds:['allowed','excluded'],
      excludeUserIds:['excluded']
    } as any);
    const data = tx.storyAudienceGrant.createMany.mock.calls.map(x => x[0].data).flat();
    expect(data).toEqual(expect.arrayContaining([
      {storyId:'story1',targetUserId:'allowed',allowed:true},
      {storyId:'story1',targetUserId:'excluded',allowed:false}
    ]));
    expect(data).not.toContainEqual({storyId:'story1',targetUserId:'excluded',allowed:true});
    expect(prisma.user.count).toHaveBeenCalledWith({where:{id:{in:['excluded']}}});
  });

  it('includes individual reactions beside viewers only on the owner-only viewers endpoint', async () => {
    const {prisma,svc} = setup();
    const viewedAt = new Date('2026-10-21T11:00:00Z');
    prisma.storyView.findMany.mockResolvedValue([
      {id:'view1',storyId:'story1',viewerUserId:'viewer1',lastViewedAt:viewedAt,viewCount:1,completionBps:10000}
    ]);
    prisma.storyView.aggregate.mockResolvedValue({_count:{_all:1},_sum:{viewCount:1,completionBps:10000}});
    prisma.storyReaction.findMany.mockResolvedValue([
      {userId:'viewer1',reaction:'🔥',customEmojiId:null}
    ]);
    const result = await svc.viewers('author','story1');
    expect(result.viewers[0].reaction).toEqual({reaction:'🔥',customEmojiId:null});
    expect(prisma.storyReaction.findMany).toHaveBeenCalledWith({
      where:{storyId:'story1',userId:{in:['viewer1']}},
      select:{userId:true,reaction:true,customEmojiId:true}
    });
  });

  it('keeps the owner-only spectactor identity list private', async () => {
    const {prisma,svc} = setup();
    prisma.story.findFirst.mockResolvedValue(null);
    await expect(svc.viewers('outsider','story1')).rejects.toThrow();
    expect(prisma.storyView.findMany).not.toHaveBeenCalled();
  });
});
