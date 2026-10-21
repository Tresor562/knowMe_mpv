import {ForbiddenException, Injectable} from '@nestjs/common';
import {ConversationRole} from '@prisma/client';
import {createHash} from 'node:crypto';
import {PrismaService} from '../prisma/prisma.service';
import {NotificationsService} from '../notifications/notifications.service';
import {RealtimeGateway} from '../realtime/realtime.gateway';

const senderSelect = {
  id:true,username:true,displayName:true,avatarUrl:true
} as const;

/**
 * Real conversation delivery for a persisted StoryReply.
 *
 * The idempotency key is the StoryReply database ID, not user-authored text.
 * No Story media is embedded into a notification or sent to another audience.
 */
@Injectable()
export class StoryReplyDirectService {
  constructor(
    private readonly prisma:PrismaService,
    private readonly notifications:NotificationsService,
    private readonly realtime:RealtimeGateway
  ) {}

  async deliver(input:{
    senderId:string;authorId:string;storyId:string;
    replyId:string;content:string;
  }) {
    const {senderId,authorId,storyId,replyId,content}=input;
    if (senderId===authorId ||
        !/^[A-Za-z0-9_-]{1,90}$/.test(replyId) ||
        !/^[A-Za-z0-9_-]{1,90}$/.test(storyId) ||
        !content.trim()) {
      throw new ForbiddenException('Réponse à la Story invalide.');
    }
    const blocked=await this.prisma.friendship.findFirst({
      where:{status:'BLOCKED',OR:[
        {requesterId:senderId,addresseeId:authorId},
        {requesterId:authorId,addresseeId:senderId}
      ]},select:{id:true}
    });
    if (blocked) throw new ForbiddenException('Cette conversation est bloquée.');

    const messageId='storyreply_'+replyId;
    const existing=await this.prisma.message.findUnique({
      where:{id:messageId},
      include:{sender:{select:senderSelect}}
    });
    if(existing)return this.present(existing);

    const pair=[senderId,authorId].sort();
    let direct=await this.prisma.conversation.findFirst({
      where:{isGroup:false,AND:[
        {members:{some:{userId:senderId}}},
        {members:{some:{userId:authorId}}},
        {members:{every:{userId:{in:pair}}}}
      ]},select:{id:true},orderBy:{createdAt:'asc'}
    });
    if(!direct){
      const id='storydm_'+createHash('sha256')
        .update(JSON.stringify(pair)).digest('hex').slice(0,32);
      direct=await this.prisma.conversation.upsert({
        where:{id},
        create:{
          id,isGroup:false,
          members:{create:pair.map(userId=>({
            userId,role:ConversationRole.MEMBER
          }))}
        },
        update:{},
        select:{id:true}
      });
    }

    const quote='↪ Story · /stories/'+storyId+'\n'+content.trim();
    try {
      const created=await this.prisma.$transaction(async tx=>{
        const message=await tx.message.create({
          data:{id:messageId,senderId,conversationId:direct.id,content:quote},
          include:{sender:{select:senderSelect}}
        });
        await Promise.all([
          tx.conversation.update({
            where:{id:direct.id},data:{updatedAt:message.createdAt}
          }),
          tx.conversationMember.update({
            where:{conversationId_userId:{conversationId:direct.id,userId:senderId}},
            data:{lastReadAt:message.createdAt}
          })
        ]);
        return message;
      });
      const presented=this.present(created);
      // Reuse the standard MESSAGE notification, not a duplicate Story alert.
      await Promise.all([
        this.notifications.createMany([{
          userId:authorId,type:'MESSAGE',
          title:'Nouvelle réponse à ta Story',
          body:content.length>120?content.slice(0,117)+'…':content,
          data:{
            route:'/messages/'+direct.id,
            entityType:'CONVERSATION',entityId:direct.id,
            messageId:messageId,actorId:senderId,messageKind:'TEXT',
            storyId
          }
        }]),
        this.realtime.emitMessageCreated(direct.id,presented),
        this.realtime.emitConversationRead(direct.id,{
          userId:senderId,lastReadAt:created.createdAt
        })
      ]);
      return presented;
    }catch(error){
      // Concurrent retry: uniqueness of Message.id prevents double delivery.
      if((error as {code?:string})?.code!=='P2002')throw error;
      const delivered=await this.prisma.message.findUnique({
        where:{id:messageId},
        include:{sender:{select:senderSelect}}
      });
      if(!delivered)throw error;
      return this.present(delivered);
    }
  }

  private present(message:{
    id:string;conversationId:string;content:string;senderId:string;
    sender:{id:string;username:string;displayName:string;avatarUrl:string|null};
    createdAt:Date;
  }){
    return {...message,presentation:{kind:'TEXT' as const,text:message.content}};
  }
}
