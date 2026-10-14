import { NotFoundException } from '@nestjs/common';
import { LinkTargetsService } from './link-targets.service';

describe('LinkTargetsService', () => {
  const prisma = {
    user: {findFirst: jest.fn()},
    challenge: {findUnique: jest.fn()},
    challengeParticipant: {findUnique: jest.fn()},
    post: { findUnique: jest.fn() },
    postComment: { findUnique: jest.fn() },
    message: { findFirst: jest.fn() },
    conversationMember: { findUnique: jest.fn() },
    channelPost: { findUnique: jest.fn() },
    notification: { findFirst: jest.fn() }
  };
  const stories = { get: jest.fn() };
  const channels = { details: jest.fn() };
  const service = new LinkTargetsService(prisma as never, stories as never, channels as never);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('resolves a valid short username to the canonical profile', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({username:'abc'});
    await expect(service.resolve('viewer_123','profile','abc')).resolves.toMatchObject({
      webPath:'/profile/abc',context:{username:'abc'}
    });
  });

  it('resolves challenges only for public active or authorized participants', async () => {
    prisma.challenge.findUnique.mockResolvedValue({id:'challenge_123',creatorId:'owner_123',visibility:'PRIVATE',status:'ACTIVE'});
    prisma.challengeParticipant.findUnique.mockResolvedValueOnce(null);
    await expect(service.resolve('outsider_123','challenge','challenge_123')).rejects.toThrow(NotFoundException);
    prisma.challengeParticipant.findUnique.mockResolvedValueOnce({id:'participant_123'});
    await expect(service.resolve('friend_123','challenge','challenge_123')).resolves.toMatchObject({
      webPath:'/challenges/challenge_123',context:{challengeId:'challenge_123'}
    });
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

  it('requires channel permission and preserves a linked post', async () => {
    prisma.channelPost.findUnique.mockResolvedValueOnce({id:'post_123456',channelId:'channel_123456'});
    channels.details.mockRejectedValueOnce(new NotFoundException('CHANNEL_NOT_FOUND'));
    await expect(service.resolve('stranger_123','channel-post','post_123456')).rejects.toThrow(NotFoundException);

    prisma.channelPost.findUnique.mockResolvedValueOnce({id:'post_123456',channelId:'channel_123456'});
    channels.details.mockResolvedValueOnce({id:'channel_123456'});
    await expect(service.resolve('follower_123','channel-post','post_123456')).resolves.toEqual({
      kind:'channel-post', id:'post_123456',
      webPath:'/channels/channel_123456?post=post_123456',
      context:{channelId:'channel_123456',channelPostId:'post_123456'}
    });
  });

  it('only resolves a gift when it belongs to the recipient', async () => {
    prisma.notification.findFirst.mockResolvedValueOnce(null);
    await expect(service.resolve('outsider_123','gift','gift_123456')).rejects.toThrow(NotFoundException);
    prisma.notification.findFirst.mockResolvedValueOnce({id:'gift_123456'});
    await expect(service.resolve('recipient_123','gift','gift_123456')).resolves.toMatchObject({
      webPath:'/gifts?gift=gift_123456',context:{giftId:'gift_123456'}
    });
    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where:{id:'gift_123456',userId:'recipient_123',type:'SOCIAL_GIFT'},
      select:{id:true}
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
    stories.get.mockResolvedValueOnce({ id: 'story_123456', allowSharing: true, viewer: { own: false } });
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
