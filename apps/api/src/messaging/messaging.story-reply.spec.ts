import {ForbiddenException} from '@nestjs/common';
import {StoryReplyDirectService} from './story-reply-direct.service';

describe('StoryReplyDirectService',()=>{
  const reply={
    senderId:'viewer',authorId:'author',storyId:'story-123',
    replyId:'reply-123',content:'Très belle story !'
  };
  const createdAt=new Date('2026-10-21T12:00:00Z');
  const sample={
    id:'storyreply_reply-123',conversationId:'direct-conversation',
    content:'↪ Story · /stories/story-123\nTrès belle story !',
    senderId:'viewer',sender:{id:'viewer',username:'viewer',displayName:'Viewer',avatarUrl:null},
    createdAt
  };
  function setup(){
    const tx={
      message:{create:jest.fn().mockResolvedValue(sample)},
      conversation:{update:jest.fn().mockResolvedValue({})},
      conversationMember:{update:jest.fn().mockResolvedValue({})}
    };
    const prisma={
      friendship:{findFirst:jest.fn().mockResolvedValue(null)},
      message:{findUnique:jest.fn().mockResolvedValue(null)},
      conversation:{
        findFirst:jest.fn().mockResolvedValue({id:'direct-conversation'}),
        upsert:jest.fn().mockResolvedValue({id:'stable'})
      },
      $transaction:jest.fn(async(fn:(db:typeof tx)=>Promise<unknown>)=>fn(tx))
    };
    const notifications={createMany:jest.fn().mockResolvedValue([])};
    const realtime={
      emitMessageCreated:jest.fn().mockResolvedValue(undefined),
      emitConversationRead:jest.fn().mockResolvedValue(undefined)
    };
    const service=new StoryReplyDirectService(prisma as any,notifications as any,realtime as any);
    return {service,prisma,tx,notifications,realtime};
  }
  it('delivers a real message into an existing two-person conversation with Story reference',async()=>{
    const {service,prisma,tx,notifications,realtime}=setup();
    const result=await service.deliver(reply);
    expect(result.presentation).toEqual({kind:'TEXT',text:sample.content});
    expect(tx.message.create).toHaveBeenCalledWith(expect.objectContaining({
      data:{
        id:'storyreply_reply-123',senderId:'viewer',conversationId:'direct-conversation',
        content:sample.content
      }
    }));
    expect(notifications.createMany).toHaveBeenCalledWith([
      expect.objectContaining({userId:'author',type:'MESSAGE',data:expect.objectContaining({
        entityId:'direct-conversation',messageId:'storyreply_reply-123',storyId:'story-123'
      })})
    ]);
    expect(realtime.emitMessageCreated).toHaveBeenCalledTimes(1);
    expect(prisma.conversation.upsert).not.toHaveBeenCalled();
  });
  it('refuses a blocked direct conversation',async()=>{
    const {service,prisma}=setup();
    prisma.friendship.findFirst.mockResolvedValue({id:'block'});
    await expect(service.deliver(reply)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.conversation.findFirst).not.toHaveBeenCalled();
  });
  it('does not send notifications or duplicate an already-delivered reply',async()=>{
    const {service,prisma,notifications,realtime}=setup();
    prisma.message.findUnique.mockResolvedValue(sample);
    const result=await service.deliver(reply);
    expect(result.id).toBe(sample.id);
    expect(prisma.conversation.findFirst).not.toHaveBeenCalled();
    expect(notifications.createMany).not.toHaveBeenCalled();
    expect(realtime.emitMessageCreated).not.toHaveBeenCalled();
  });
  it('constructs a deterministic two-person conversation if none exists',async()=>{
    const {service,prisma}=setup();
    prisma.conversation.findFirst.mockResolvedValue(null);
    await service.deliver(reply);
    expect(prisma.conversation.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where:{id:expect.stringMatching(/^storydm_[a-f0-9]{32}$/)},
      create:expect.objectContaining({isGroup:false,members:{create:[
        {userId:'author',role:'MEMBER'},{userId:'viewer',role:'MEMBER'}
      ]}})
    }));
  });
  it('handles a duplicate Message ID race by returning the committed message',async()=>{
    const {service,prisma,notifications}=setup();
    prisma.$transaction.mockRejectedValue({code:'P2002'});
    prisma.message.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(sample);
    const result=await service.deliver(reply);
    expect(result.id).toBe(sample.id);
    expect(notifications.createMany).not.toHaveBeenCalled();
  });
  it('rejects self replies and invalid IDs before touching the database',async()=>{
    const {service,prisma}=setup();
    await expect(service.deliver({...reply,authorId:'viewer'}))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.deliver({...reply,replyId:'../../bad'}))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.friendship.findFirst).not.toHaveBeenCalled();
  });
});
