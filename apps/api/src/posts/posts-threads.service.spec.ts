import { NotFoundException } from '@nestjs/common';
import { PostsService } from './posts.service';

describe('Post comment threads', () => {
  const author = {
    id: 'user-a', username: 'usera', displayName: 'A',
    email: null, avatarUrl: null, staffAccount: null, verificationRequests: []
  };

  function setup() {
    const prisma = {
      post: { findUnique: jest.fn().mockResolvedValue({ id: 'post-a', authorId: 'owner' }) },
      user: { findUnique: jest.fn().mockResolvedValue({ displayName: 'Alice' }) },
      postComment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn()
      }
    };
    const notifications = { create: jest.fn().mockResolvedValue({}) };
    const service = new PostsService(prisma as any, notifications as any, {} as any);
    return { prisma, service, notifications };
  }

  it('rejects replying to a comment from a different post', async () => {
    const { service, prisma } = setup();
    prisma.postComment.findFirst.mockResolvedValue(null);
    await expect(service.comment('alice', 'post-a', {
      content: 'Answer', parentId: 'foreign-comment'
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.postComment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id:'foreign-comment', postId:'post-a' } })
    );
    expect(prisma.postComment.create).not.toHaveBeenCalled();
  });

  it('creates a reply only after checking the parent belongs to the post', async () => {
    const { service, prisma } = setup();
    prisma.postComment.findFirst.mockResolvedValue({ id:'parent-a' });
    prisma.postComment.create.mockResolvedValue({
      id:'reply-a', postId:'post-a', authorId:'alice',
      parentId:'parent-a', content:'Hello', author
    });
    const result = await service.comment('alice','post-a',{
      content:' Hello ', parentId:'parent-a'
    });
    expect(prisma.postComment.create).toHaveBeenCalledWith(
      expect.objectContaining({data: {
        postId:'post-a',authorId:'alice',parentId:'parent-a',content:'Hello'
      }})
    );
    expect(result.parentId).toBe('parent-a');
  });

  it('lists only root comments when requested by the modern Web client', async () => {
    const { service, prisma } = setup();
    prisma.postComment.findMany.mockResolvedValue([]);
    await service.comments('post-a',undefined,true);
    expect(prisma.postComment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {postId:'post-a',parentId:null},take:30 })
    );
    await service.comments('post-a');
    expect(prisma.postComment.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: {postId:'post-a'},take:30 })
    );
  });

  it('paginates a parent’s replies, scoped to the same post', async () => {
    const { service, prisma } = setup();
    prisma.postComment.findFirst.mockResolvedValue({id:'parent-a'});
    prisma.postComment.findMany.mockResolvedValue([]);
    await service.commentReplies('post-a','parent-a','cursor-1');
    expect(prisma.postComment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where:{postId:'post-a',parentId:'parent-a'},
        skip:1,cursor:{id:'cursor-1'},take:30
      })
    );
  });
});
