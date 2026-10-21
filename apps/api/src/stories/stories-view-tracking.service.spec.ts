import { StoriesService } from './stories.service';

describe('StoriesService.view — counting actual openings rather than progress', () => {
  const makeService = (authorUserId = 'author') => {
    const prisma = {
      story: { findUnique: jest.fn().mockResolvedValue({
        id: 'story-1', authorUserId, status: 'PUBLISHED', startsAt: new Date(0),
        expiresAt: new Date('2099-01-01'), pinnedAt: null, audience: 'PUBLIC'
      }) },
      storyView: { upsert: jest.fn().mockResolvedValue({ id:'view-1' }) },
      storyAudienceGrant: {findUnique: jest.fn().mockResolvedValue(null)}
    };
    return { prisma, service:new StoriesService(prisma as any, {} as any, {} as any) };
  };

  it('counts a fresh opening and a later replay, but not completion events',async()=>{
    const { prisma, service }=makeService();
    await service.view('viewer','story-1',{completionBps:0});
    const open=prisma.storyView.upsert.mock.calls[0]?.[0];
    expect(open.create.completionBps).toBe(0);
    expect(open.update).toMatchObject({
      lastViewedAt:expect.any(Date),viewCount:{increment:1},completionBps:0
    });

    await service.view('viewer','story-1',{completionBps:6500});
    const progressed=prisma.storyView.upsert.mock.calls[1]?.[0];
    expect(progressed.update.completionBps).toBe(6500);
    expect(progressed.update).not.toHaveProperty('viewCount');
    expect(progressed.update).not.toHaveProperty('lastViewedAt');

    await service.view('viewer','story-1',{completionBps:10000});
    const completed=prisma.storyView.upsert.mock.calls[2]?.[0];
    expect(completed.update.completionBps).toBe(10000);
    expect(completed.update).not.toHaveProperty('viewCount');

    await service.view('viewer','story-1',{completionBps:0});
    expect(prisma.storyView.upsert.mock.calls[3]?.[0].update.viewCount)
      .toEqual({increment:1});
  });

  it('screenshot events preserve the last completion and never add a view',async()=>{
    const {prisma,service}=makeService();
    await service.view('viewer','story-1',{screenshot:true});
    const screenshot=prisma.storyView.upsert.mock.calls[0]?.[0];
    expect(screenshot.create.screenshotAt).toBeInstanceOf(Date);
    expect(screenshot.update.screenshotAt).toBeInstanceOf(Date);
    expect(screenshot.update).not.toHaveProperty('viewCount');
    expect(screenshot.update).not.toHaveProperty('completionBps');

    await service.view('viewer','story-1',{screenshot:true,completionBps:0});
    expect(prisma.storyView.upsert.mock.calls[1]?.[0].update)
      .not.toHaveProperty('completionBps');
    expect(prisma.storyView.upsert.mock.calls[1]?.[0].update)
      .not.toHaveProperty('viewCount');
  });

  it('an owner checking their own Story does not create any view',async()=>{
    const {prisma,service}=makeService('viewer');
    expect(await service.view('viewer','story-1',{completionBps:0}))
      .toEqual({recorded:false,ownerView:true});
    expect(prisma.storyView.upsert).not.toHaveBeenCalled();
  });
});
