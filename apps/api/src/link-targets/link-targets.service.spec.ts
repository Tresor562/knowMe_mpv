import { NotFoundException } from '@nestjs/common';
import { LinkTargetsService } from './link-targets.service';

describe('LinkTargetsService', () => {
  const prisma = {
    post: { findUnique: jest.fn() },
    postComment: { findUnique: jest.fn() },
    message: { findFirst: jest.fn() },
    conversationMember: { findUnique: jest.fn() }
  };
  const stories = { get: jest.fn() };
  const service = new LinkTargetsService(prisma as never, stories as never);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('resolves an exact comment to its post without losing the comment ID', async () => {
    prisma.postComment.findUnique.mockResolvedValue({ id: 'comment_123456', postId: 'post_123456' });
    await expect(service.resolve('viewer_123', 'comment', 'comment_123456')).resolves.toEqual({
      kind: 'comment',
      id: 'comment_123456',
      webPath: '/feed/post_123456?comment=comment_123456',
      context: { postId: 'post_123456', commentId: 'comment_123456' }
    });
  });

  it('resolves private messages only when the viewer belongs to the conversation', async () => {
    prisma.message.findFirst.mockResolvedValueOnce(null);
    await expect(service.resolve('outsider_123', 'message', 'message_123456'))
      .rejects.toThrow(NotFoundException);
    prisma.message.findFirst.mockResolvedValueOnce({ id: 'message_123456', conversationId: 'chat_123456' });
    await expect(service.resolve('member_1234', 'message', 'message_123456')).resolves.toMatchObject({
      webPath: '/messages/chat_123456?message=message_123456'
    });
    expect(prisma.message.findFirst).toHaveBeenCalledWith({
      where: { id: 'message_123456', conversation: { members: { some: { userId: 'member_1234' } } } },
      select: { id: true, conversationId: true }
    });
  });

  it('does not reveal a media attachment without conversation membership', async () => {
    prisma.message.findFirst.mockResolvedValue(null);
    await expect(service.resolve('outsider_123', 'media', 'asset_123456')).rejects.toThrow(NotFoundException);
    expect(prisma.message.findFirst).toHaveBeenCalledWith({
      where: { mediaAssetId: 'asset_123456', conversation: { members: { some: { userId: 'outsider_123' } } } },
      select: { id: true, conversationId: true }
    });
  });

  it('uses the story audience authorization service', async () => {
    stories.get.mockRejectedValueOnce(new NotFoundException('STORY_NOT_VISIBLE'));
    await expect(service.resolve('outsider_123', 'story', 'story_123456')).rejects.toThrow(NotFoundException);
    stories.get.mockResolvedValueOnce({ id: 'story_123456' });
    await expect(service.resolve('member_1234', 'story', 'story_123456')).resolves.toMatchObject({
      webPath: '/stories/story_123456'
    });
  });

  it('rejects unsafe, unsupported and private targets identically', async () => {
    for (const [kind, id] of [['admin', 'abc_123456'], ['message', '../admin'], ['sticker', 'unknown_123']]) {
      await expect(service.resolve('viewer_123', kind, id)).rejects.toThrow(NotFoundException);
    }
  });
});
