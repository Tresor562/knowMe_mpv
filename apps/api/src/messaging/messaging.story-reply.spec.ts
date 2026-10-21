import {ForbiddenException} from '@nestjs/common';
import {MessagingService} from './messaging.service';

describe('MessagingService StoryReply direct delivery',()=>{
  function make() {
    const prisma={
      friendship:{findFirst:jest.fn().mockResolvedValue(null)},
      message:{findUnique:jest.fn().mockResolvedValue(null)},
      conversation:{
        findFirst:jest.fn().mockResolvedValue({id:'direct-conversation'}),
        upsert:jest.fn()
      }
    };
    const service=new MessagingService(prisma as any,{} as any,{} as any,{
      resolve:jest.fn().mockReturnValue(null)
    } as any);
    return {prisma,service};
  }
  const reply={
    senderId:'viewer',authorId:'author',storyId:'story-123',
    replyId:'reply-123',content:'Très belle story !'
  };

  it('uses an existing private conversation, stable message ID and Story reference',async()=>{
    const {service,prisma}=make();
    const deliver=jest.spyOn(service as any,'sendAuthorized').mockResolvedValue({id:'storyreply_reply-123'});
    await service.sendStoryReplyMessage(reply);
    expect(prisma.conversation.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where:expect.objectContaining({isGroup:false}),
      select:{id:true}
    }));
    expect(prisma.conversation.upsert).not.toHaveBeenCalled();
    expect(deliver).toHaveBeenCalledWith(
      'viewer','direct-conversation',
      '↪ Story · /stories/story-123\nTrès belle story !',
      undefined,'storyreply_reply-123'
    );
  });

  it('rejects deliveries when either side blocked the other',async()=>{
    const {service,prisma}=make();
    prisma.friendship.findFirst.mockResolvedValue({id:'blocked'});
    await expect(service.sendStoryReplyMessage(reply)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.conversation.findFirst).not.toHaveBeenCalled();
  });

  it('never duplicates an already persisted Story message',async()=>{
    const {service,prisma}=make();
    prisma.message.findUnique.mockResolvedValue({
      id:'storyreply_reply-123',conversationId:'direct-conversation',
      content:'↪ Story',senderId:'viewer'
    });
    const deliver=jest.spyOn(service as any,'sendAuthorized');
    const result=await service.sendStoryReplyMessage(reply);
    expect(result.id).toBe('storyreply_reply-123');
    expect(deliver).not.toHaveBeenCalled();
    expect(prisma.conversation.findFirst).not.toHaveBeenCalled();
  });

  it('uses one deterministic two-person conversation across retries',async()=>{
    const {service,prisma}=make();
    prisma.conversation.findFirst.mockResolvedValue(null);
    prisma.conversation.upsert.mockResolvedValue({id:'stable'});
    jest.spyOn(service as any,'sendAuthorized').mockResolvedValue({id:'ok'});
    await service.sendStoryReplyMessage(reply);
    expect(prisma.conversation.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where:{id:expect.stringMatching(/^storydm_[a-f0-9]{32}$/)},
      create:expect.objectContaining({
        isGroup:false,members:{create:[
          {userId:'author',role:'MEMBER'},
          {userId:'viewer',role:'MEMBER'}
        ]}
      })
    }));
  });

  it('rejects self replies and invalid delivery identifiers',async()=>{
    const {service}=make();
    await expect(service.sendStoryReplyMessage({...reply,authorId:'viewer'}))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.sendStoryReplyMessage({...reply,replyId:'../../danger'}))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});
