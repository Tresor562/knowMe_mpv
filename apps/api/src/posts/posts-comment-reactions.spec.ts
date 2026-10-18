import { NotFoundException } from '@nestjs/common';
import { PostsService } from './posts.service';

describe('KnowMe post comment emoji reactions', () => {
  function setup(comment: {id:string;authorId:string}|null = {id:'comment-a',authorId:'bob'}) {
    const prisma = {
      postComment: {findFirst: jest.fn().mockResolvedValue(comment)},
      postCommentReaction: {
        upsert:jest.fn().mockResolvedValue({}),
        deleteMany:jest.fn().mockResolvedValue({count:1}),
        groupBy:jest.fn().mockResolvedValue([{emoji:'❤️',_count:{_all:2}}]),
        findUnique:jest.fn().mockResolvedValue({emoji:'❤️'})
      }
    };
    const notifications={create:jest.fn().mockResolvedValue({})};
    const service=new PostsService(prisma as any, notifications as any, {} as any);
    return {service,prisma,notifications};
  }
  it('must reject reactions to a comment outside the specified post',async()=>{
    const {service,prisma}=setup(null);
    await expect(service.setCommentReaction('alice','post-a','foreign','❤️'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.postCommentReaction.upsert).not.toHaveBeenCalled();
    expect(prisma.postComment.findFirst).toHaveBeenCalledWith({
      where:{id:'foreign',postId:'post-a'},select:{id:true,authorId:true}
    });
  });
  it('upserts one reaction per user, and summarizes total counts',async()=>{
    const {service,prisma}=setup();
    const result=await service.setCommentReaction('alice','post-a','comment-a','❤️');
    expect(prisma.postCommentReaction.upsert).toHaveBeenCalledWith({
      where:{commentId_userId:{commentId:'comment-a',userId:'alice'}},
      create:{commentId:'comment-a',userId:'alice',emoji:'❤️'},
      update:{emoji:'❤️'}
    });
    expect(result).toEqual({commentId:'comment-a',total:2,
      emojis:[{emoji:'❤️',count:2}],mine:'❤️'});
  });
  it('lets a user remove only their own reaction',async()=>{
    const {service,prisma}=setup();
    await service.removeCommentReaction('alice','post-a','comment-a');
    expect(prisma.postCommentReaction.deleteMany).toHaveBeenCalledWith({
      where:{commentId:'comment-a',userId:'alice'}
    });
  });
  it('does not notify a user reacting to their own comment',async()=>{
    const {service,notifications}=setup({id:'comment-a',authorId:'alice'});
    await service.setCommentReaction('alice','post-a','comment-a','😂');
    expect(notifications.create).not.toHaveBeenCalled();
  });
  it('a notification outage does not claim a stored reaction failed',async()=>{
    const {service,notifications}=setup();
    notifications.create.mockRejectedValue(new Error('notifications unavailable'));
    await expect(service.setCommentReaction('alice','post-a','comment-a','❤️'))
      .resolves.toEqual(expect.objectContaining({total:2}));
  });
});
