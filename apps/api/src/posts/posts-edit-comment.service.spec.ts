import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PostsService } from './posts.service';

describe('PostsService.editComment', () => {
  const actor = 'user-owner';
  const postId = 'post-1';
  const commentId = 'comment-1';

  function setup() {
    const prisma = {
      postComment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({
          id: commentId,
          postId,
          authorId: actor,
          content: 'Texte corrigé',
          createdAt: new Date('2026-10-18T00:00:00Z'),
          author: {
            id: actor, username: 'owner', displayName: 'Owner', avatarUrl: null,
            email: null, staffAccount: null, verificationRequests: []
          }
        })
      }
    };
    return { prisma, service: new PostsService(prisma as any, {} as any, {} as any) };
  }

  it('updates only the comment owned by the active user for that post', async () => {
    const { service, prisma } = setup();
    const result = await service.editComment(actor, postId, commentId, '  Texte corrigé  ');
    expect(prisma.postComment.updateMany).toHaveBeenCalledWith({
      where: { id: commentId, postId, authorId: actor },
      data: { content: 'Texte corrigé' }
    });
    expect(result.content).toBe('Texte corrigé');
    expect(result.author).toMatchObject({ id: actor, displayName: 'Owner' });
    expect(result.author).not.toHaveProperty('email');
  });

  it('blocks editing someone else’s comment even on your own post', async () => {
    const { service, prisma } = setup();
    prisma.postComment.updateMany.mockResolvedValue({ count: 0 });
    prisma.postComment.findUnique.mockResolvedValue({ postId });
    await expect(service.editComment('different-user', postId, commentId, 'Hacked'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not reveal comments belonging to another post', async () => {
    const { service, prisma } = setup();
    prisma.postComment.updateMany.mockResolvedValue({ count: 0 });
    prisma.postComment.findUnique.mockResolvedValue({ postId: 'other-post' });
    await expect(service.editComment(actor, postId, commentId, 'Update'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it.each(['', '  ', 'a'.repeat(501)])('rejects an empty or oversized edit', async (content) => {
    const { service, prisma } = setup();
    await expect(service.editComment(actor, postId, commentId, content))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.postComment.updateMany).not.toHaveBeenCalled();
  });
});
