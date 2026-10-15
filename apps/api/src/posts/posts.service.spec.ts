import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PostsService } from './posts.service';

describe('PostsService.update', () => {
  const prisma = {
    post: {
      findUnique: jest.fn(),
      updateMany: jest.fn()
    }
  };
  const notifications = {} as NotificationsService;
  const moderation = { assertAllowed: jest.fn() };
  let posts: PostsService;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.post.findUnique.mockResolvedValue({
      id: 'post-1', authorId: 'author-1', content: 'Bonjour', imageUrl: 'https://example.org/old.jpg'
    });
    prisma.post.updateMany.mockResolvedValue({ count: 1 });
    moderation.assertAllowed.mockResolvedValue(undefined);
    posts = new PostsService(
      prisma as unknown as PrismaService,
      notifications,
      moderation as unknown as ModerationService
    );
    jest.spyOn(posts, 'getById').mockResolvedValue({ id: 'post-1', content: 'Modifié' } as never);
  });

  it('rejects attempts to modify another person’s post', async () => {
    await expect(posts.update('attacker', 'post-1', { content: 'Modifié' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.post.updateMany).not.toHaveBeenCalled();
    expect(moderation.assertAllowed).not.toHaveBeenCalled();
  });

  it('rejects a missing post before any write', async () => {
    prisma.post.findUnique.mockResolvedValueOnce(null);
    await expect(posts.update('author-1', 'missing', { content: 'Modifié' }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.post.updateMany).not.toHaveBeenCalled();
  });

  it('checks changed captions and atomically limits writes to the owner', async () => {
    await posts.update('author-1', 'post-1', { content: 'Modifié', imageUrl: null });
    expect(moderation.assertAllowed).toHaveBeenCalledWith({
      actorId: 'author-1', action: 'POST_EDIT', content: 'Modifié', targetId: 'post-1'
    });
    expect(prisma.post.updateMany).toHaveBeenCalledWith({
      where: { id: 'post-1', authorId: 'author-1' },
      data: { content: 'Modifié', imageUrl: null }
    });
  });

  it('does not record a duplicate moderation event when only the image changes', async () => {
    await posts.update('author-1', 'post-1', {
      content: 'Bonjour', imageUrl: 'https://example.org/new.jpg'
    });
    expect(moderation.assertAllowed).not.toHaveBeenCalled();
    expect(prisma.post.updateMany).toHaveBeenCalledWith({
      where: { id: 'post-1', authorId: 'author-1' },
      data: { content: 'Bonjour', imageUrl: 'https://example.org/new.jpg' }
    });
  });

  it('detects an intervening removal before returning the edited post', async () => {
    prisma.post.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(posts.update('author-1', 'post-1', { content: 'Modifié' }))
      .rejects.toBeInstanceOf(ConflictException);
  });
});
