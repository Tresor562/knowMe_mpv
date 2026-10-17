import { PostsService } from './posts.service';

describe('KnowMe threaded comment notifications', () => {
  const author = {
    id: 'alice', username: 'alice', displayName: 'Alice',
    email: null, avatarUrl: null, staffAccount: null, verificationRequests: []
  };
  function setup(parentAuthorId: string | null) {
    const prisma = {
      post: { findUnique: jest.fn().mockResolvedValue({ id:'post-one', authorId:'owner' }) },
      user: { findUnique: jest.fn().mockResolvedValue({ displayName: 'Alice' }) },
      postComment: {
        findFirst: jest.fn().mockResolvedValue(parentAuthorId
          ? { id:'parent-one', authorId:parentAuthorId } : null),
        create: jest.fn().mockResolvedValue({
          id:'reply-one', postId:'post-one', authorId:'alice', content:'Merci',
          parentId:'parent-one', author, _count:{ replies:0 }
        })
      }
    };
    const notifications = { create: jest.fn().mockResolvedValue({}) };
    const service = new PostsService(prisma as any, notifications as any, {} as any);
    return { service, notifications };
  }

  it('alerts the post owner and the replied-to author once each', async () => {
    const { service, notifications } = setup('bob');
    await service.comment('alice', 'post-one',
      { content:'Merci', parentId:'parent-one' });
    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId:'owner', type:'POST_COMMENTED' })
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId:'bob', type:'COMMENT_REPLIED' })
    );
  });

  it('does not duplicate notifications to the post owner', async () => {
    const { service, notifications } = setup('owner');
    await service.comment('alice', 'post-one',
      { content:'Merci', parentId:'parent-one' });
    expect(notifications.create).toHaveBeenCalledTimes(1);
  });

  it('does not notify a user for replying to themselves', async () => {
    const { service, notifications } = setup('alice');
    await service.comment('alice', 'post-one',
      { content:'Merci', parentId:'parent-one' });
    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId:'owner' })
    );
  });

  it('does not report a committed reply as failed when notification delivery fails', async () => {
    const { service, notifications } = setup('bob');
    notifications.create.mockRejectedValue(new Error('Notifications offline'));
    await expect(service.comment('alice', 'post-one', {
      content: 'Merci', parentId: 'parent-one'
    })).resolves.toEqual(expect.objectContaining({
      id:'reply-one', parentId:'parent-one'
    }));
  });
});
