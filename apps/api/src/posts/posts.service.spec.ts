import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PostsService } from './posts.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';

describe('PostsService author-only edit', () => {
  const findUnique = jest.fn();
  const updateMany = jest.fn();
  const prisma = { post: { findUnique, updateMany } } as unknown as PrismaService;
  const service = new PostsService(prisma, {} as NotificationsService);

  beforeEach(() => { jest.resetAllMocks(); });

  it('edits text for the actual owner using an atomic author-scoped update', async () => {
    findUnique.mockResolvedValueOnce({ authorId: 'owner' })
      .mockResolvedValueOnce({ id: 'post1', content: 'Updated' });
    updateMany.mockResolvedValueOnce({ count: 1 });

    await expect(service.update('owner', 'post1', { content: 'Updated' }))
      .resolves.toEqual({ id: 'post1', content: 'Updated' });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'post1', authorId: 'owner' },
      data: { content: 'Updated' }
    });
  });

  it('rejects another user without modifying the publication', async () => {
    findUnique.mockResolvedValueOnce({ authorId: 'owner' });
    await expect(service.update('stranger', 'post1', { content: 'Hacked' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('returns not-found if the publication does not exist', async () => {
    findUnique.mockResolvedValueOnce(null);
    await expect(service.update('owner', 'missing', { content: 'Updated' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('does not claim success if the publication was deleted between checks', async () => {
    findUnique.mockResolvedValueOnce({ authorId: 'owner' });
    updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.update('owner', 'post1', { content: 'Updated' }))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
