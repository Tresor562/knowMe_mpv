import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PostsService } from './posts.service';

describe('Post comment emoji reactions', () => {
  function setup() {
    const prisma = {
      postComment: {
        findFirst: jest.fn().mockResolvedValue({id:'comment-a'}),
        findMany: jest.fn().mockResolvedValue([{id:'comment-a'}])
      },
      postCommentReaction: {
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({count:1}),
        groupBy: jest.fn().mockResolvedValue([{ commentId:'comment-a',emoji:'❤️',_count:{_all:2}}]),
        findMany: jest.fn().mockResolvedValue([{ commentId:'comment-a',emoji:'❤️'}])
      }
    };
    const posts = new PostsService(prisma as any, {} as any, {} as any);
    return { prisma, posts };
  }

  it('stores one reaction per user and returns counts with the user selection', async () => {
    const { prisma, posts } = setup();
    await expect(posts.setCommentReaction('viewer','post-a','comment-a','❤️')).resolves.toEqual({
      total:2,mine:'❤️',emojis:[{emoji:'❤️',count:2}]
    });
    expect(prisma.postComment.findFirst).toHaveBeenCalledWith({
      where:{id:'comment-a',postId:'post-a'},select:{id:true}
    });
    expect(prisma.postCommentReaction.upsert).toHaveBeenCalledWith({
      where:{commentId_userId:{commentId:'comment-a',userId:'viewer'}},
      create:{commentId:'comment-a',userId:'viewer',emoji:'❤️'},
      update:{emoji:'❤️'}
    });
  });

  it('removes only the acting user’s reaction', async () => {
    const { prisma, posts } = setup();
    await posts.removeCommentReaction('viewer','post-a','comment-a');
    expect(prisma.postCommentReaction.deleteMany).toHaveBeenCalledWith({
      where:{commentId:'comment-a',userId:'viewer'}
    });
  });

  it('refuses reactions to comments outside the post', async () => {
    const { prisma, posts } = setup();
    prisma.postComment.findFirst.mockResolvedValue(null);
    await expect(posts.setCommentReaction('viewer','post-a','foreign','😮')).rejects
      .toBeInstanceOf(NotFoundException);
    expect(prisma.postCommentReaction.upsert).not.toHaveBeenCalled();
  });

  it('accepts single pictographic graphemes, rejects text and compound messages', async () => {
    const { posts } = setup();
    await expect(posts.setCommentReaction('viewer','post-a','comment-a','👩‍💻')).resolves.toBeDefined();
    await expect(posts.setCommentReaction('viewer','post-a','comment-a','hello')).rejects
      .toBeInstanceOf(BadRequestException);
    await expect(posts.setCommentReaction('viewer','post-a','comment-a','❤️😮')).rejects
      .toBeInstanceOf(BadRequestException);
  });

  it('does not expose reactions outside the post or query more than 30 comments', async () => {
    const { prisma, posts } = setup();
    prisma.postComment.findMany.mockResolvedValue([]);
    await expect(posts.commentReactionSummaries('viewer','post-a',['not-here'])).resolves.toEqual({});
    await expect(posts.commentReactionSummaries('viewer','post-a',Array.from({length:31},(_,i)=>String(i)))).rejects
      .toBeInstanceOf(BadRequestException);
  });
});
