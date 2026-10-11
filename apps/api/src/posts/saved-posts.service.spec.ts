import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ModerationService } from '../moderation/moderation.service';
import { PostsService } from './posts.service';

describe('personal saved posts', () => {
  const prisma = {
    post: { findUnique: jest.fn() },
    savedPost: {
      createMany: jest.fn(), deleteMany: jest.fn(), findUnique: jest.fn(), findMany: jest.fn()
    }
  };
  const service = new PostsService(
    prisma as unknown as PrismaService,
    {} as NotificationsService,
    {} as ModerationService
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.post.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.savedPost.createMany.mockResolvedValue({count: 1});
    prisma.savedPost.deleteMany.mockResolvedValue({count: 1});
  });

  it('never saves a nonexistent publication', async () => {
    prisma.post.findUnique.mockResolvedValue(null);
    await expect(service.save('u1', 'nope')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.savedPost.createMany).not.toHaveBeenCalled();
  });

  it('uses an idempotent unique bookmark per account', async () => {
    await service.save('u1', 'p1');
    expect(prisma.savedPost.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'u1', postId: 'p1' }],
      skipDuplicates: true
    });
  });

  it('removes only the caller bookmark, idempotently', async () => {
    await expect(service.unsave('u1', 'p1')).resolves.toEqual({saved:false});
    expect(prisma.savedPost.deleteMany).toHaveBeenCalledWith({where:{userId:'u1',postId:'p1'}});
  });

  it('returns the caller scoped bookmark state', async () => {
    prisma.savedPost.findUnique.mockResolvedValueOnce({id:'saved'}).mockResolvedValueOnce(null);
    await expect(service.isSaved('u1','p1')).resolves.toEqual({saved:true});
    await expect(service.isSaved('u2','p1')).resolves.toEqual({saved:false});
    expect(prisma.savedPost.findUnique).toHaveBeenNthCalledWith(1, {
      where: { userId_postId: { userId: 'u1', postId: 'p1' } },
      select: { id: true }
    });
  });

  it('lists only the caller collection with bounded results and media metadata', async () => {
    prisma.savedPost.findMany.mockResolvedValue([{id:'saved',post:{id:'p1'}}]);
    const saved=await service.saved('u1');
    expect(saved).toHaveLength(1);
    expect(prisma.savedPost.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {userId:'u1'}, take:40
    }));
  });
});
