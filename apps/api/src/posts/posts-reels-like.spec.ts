import { NotFoundException } from '@nestjs/common';
import { PostsService } from './posts.service';

describe('Reels double-tap ensures a post is liked', () => {
  function setup() {
    const prisma = {
      post: { findUnique: jest.fn().mockResolvedValue({id:'p1',authorId:'creator'}) },
      user: { findUnique: jest.fn().mockResolvedValue({displayName:'Viewer'}) },
      postLike: {
        create: jest.fn().mockResolvedValue({id:'like1'}),
        count: jest.fn().mockResolvedValue(17)
      }
    };
    const notifications = { create: jest.fn().mockResolvedValue({}) };
    const service = new PostsService(prisma as any, notifications as any, {} as any);
    return { service, prisma, notifications };
  }
  it('creates a like and returns the authoritative count', async () => {
    const { service,prisma,notifications } = setup();
    const value = await service.ensureLike('viewer','p1');
    expect(prisma.postLike.create).toHaveBeenCalledWith({
      data:{postId:'p1',userId:'viewer'}
    });
    expect(prisma.postLike.count).toHaveBeenCalledWith({where:{postId:'p1'}});
    expect(value).toEqual({liked:true,count:17});
    expect(notifications.create).toHaveBeenCalledTimes(1);
  });
  it('a previously liked video remains liked and never re-notifies', async () => {
    const {service,prisma,notifications} = setup();
    prisma.postLike.create.mockRejectedValue({code:'P2002'});
    await expect(service.ensureLike('viewer','p1')).resolves.toEqual({
      liked:true,count:17
    });
    expect(notifications.create).not.toHaveBeenCalled();
    expect(prisma.postLike.count).toHaveBeenCalledTimes(1);
  });
  it('does not report a committed like as failed after notification outage', async () => {
    const {service,notifications} = setup();
    notifications.create.mockRejectedValue(new Error('notifications offline'));
    await expect(service.ensureLike('viewer','p1')).resolves.toEqual({
      liked:true,count:17
    });
  });
  it('never creates a like for a missing post', async () => {
    const {service,prisma} = setup();
    prisma.post.findUnique.mockResolvedValue(null);
    await expect(service.ensureLike('viewer','missing'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.postLike.create).not.toHaveBeenCalled();
  });
  it('does not suppress other storage errors', async () => {
    const {service,prisma} = setup();
    prisma.postLike.create.mockRejectedValue(new Error('database unavailable'));
    await expect(service.ensureLike('viewer','p1'))
      .rejects.toThrow('database unavailable');
  });
});
