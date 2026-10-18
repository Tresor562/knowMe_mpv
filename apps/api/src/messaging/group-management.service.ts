import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { ConversationRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UpdateGroupDto,UpdateGroupPermissionsDto } from './group-management.dto';

const memberUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true
} as const;

@Injectable()
export class GroupManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway
  ) {}

  private async actor(
    tx: Prisma.TransactionClient,
    userId: string,
    conversationId: string,
    allowed: ConversationRole[]
  ) {
    const conversation = await tx.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        isGroup: true,
        members: { where: { userId }, select: { role: true } }
      }
    });
    // Do not distinguish inaccessible groups from nonexistent groups.
    if (!conversation?.isGroup || conversation.members.length === 0) {
      throw new NotFoundException('GROUP_NOT_FOUND');
    }
    if (!allowed.includes(conversation.members[0].role)) {
      throw new ForbiddenException('GROUP_PERMISSION_DENIED');
    }
    return conversation.members[0].role;
  }

  async details(userId: string, conversationId: string) {
    const chat = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        members: {
          include: { user: { select: memberUserSelect } },
          orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }]
        }
      }
    });
    if (!chat?.isGroup || !chat.members.some(m => m.userId === userId)) {
      throw new NotFoundException('GROUP_NOT_FOUND');
    }
    const role = chat.members.find(m => m.userId === userId)!.role;
    return {
      id: chat.id, title: chat.title, description: chat.description,
      createdAt: chat.createdAt, viewerRole: role, isGroup: true,
      members: chat.members, memberCount: chat.members.length,
      permissions:{
        membersCanSendMessages:chat.membersCanSendMessages,
        membersCanSendMedia:chat.membersCanSendMedia,
        membersCanSendStickers:chat.membersCanSendStickers,
        membersCanEditInfo:chat.membersCanEditInfo,
        membersCanAddMembers:chat.membersCanAddMembers
      }
    };
  }

  async update(userId: string, conversationId: string, dto: UpdateGroupDto) {
    if (dto.title === undefined && dto.description === undefined) {
      throw new BadRequestException('GROUP_NO_CHANGES');
    }
    const title = dto.title === undefined ? undefined : dto.title.trim();
    if (title !== undefined && !title) throw new BadRequestException('GROUP_TITLE_REQUIRED');
    return this.prisma.$transaction(async tx => {
      const role=await this.actor(tx,userId,conversationId,
        [ConversationRole.OWNER,ConversationRole.ADMIN,ConversationRole.MEMBER]);
      if(role===ConversationRole.MEMBER){
        const record=await tx.conversation.findUnique({where:{id:conversationId},
          select:{membersCanEditInfo:true}});
        if(!record?.membersCanEditInfo)throw new ForbiddenException('GROUP_PERMISSION_EDIT_INFO');
      }
      return tx.conversation.update({
        where: { id: conversationId },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {})
        },
        select: { id: true, title: true, description: true }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /** Admin/owner-only changes, committed atomically with role verification. */
  async updatePermissions(userId:string,conversationId:string,dto:UpdateGroupPermissionsDto){
    const permitted=['membersCanSendMessages','membersCanSendMedia','membersCanSendStickers',
      'membersCanEditInfo','membersCanAddMembers'] as const;
    const changes=Object.fromEntries(permitted.filter(key=>dto[key]!==undefined)
      .map(key=>[key,dto[key]])) as UpdateGroupPermissionsDto;
    if(!Object.keys(changes).length)throw new BadRequestException('GROUP_NO_CHANGES');
    return this.prisma.$transaction(async tx=>{
      await this.actor(tx,userId,conversationId,[ConversationRole.OWNER,ConversationRole.ADMIN]);
      const updated=await tx.conversation.update({where:{id:conversationId},
        data:changes,select:{
          membersCanSendMessages:true,membersCanSendMedia:true,membersCanSendStickers:true,
          membersCanEditInfo:true,membersCanAddMembers:true
        }});
      return {permissions:updated};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  async addMembers(userId: string, conversationId: string, requested: string[]) {
    const ids = [...new Set(requested)].filter(id => id !== userId);
    if (!ids.length || ids.length > 20) throw new BadRequestException('GROUP_MEMBERS_INVALID');
    return this.prisma.$transaction(async tx => {
      const role=await this.actor(tx,userId,conversationId,
        [ConversationRole.OWNER,ConversationRole.ADMIN,ConversationRole.MEMBER]);
      if(role===ConversationRole.MEMBER){
        const record=await tx.conversation.findUnique({where:{id:conversationId},
          select:{membersCanAddMembers:true}});
        if(!record?.membersCanAddMembers)throw new ForbiddenException('GROUP_PERMISSION_ADD_MEMBERS');
      }
      const [existing, friendships] = await Promise.all([
        tx.conversationMember.findMany({
          where: { conversationId }, select: { userId: true }
        }),
        tx.friendship.findMany({
          where: { status: 'ACCEPTED', OR: [
            { requesterId: userId, addresseeId: { in: ids } },
            { addresseeId: userId, requesterId: { in: ids } }
          ] },
          select: { requesterId: true, addresseeId: true }
        })
      ]);
      const known = new Set(existing.map(m => m.userId));
      const fresh = ids.filter(id => !known.has(id));
      if (fresh.length + existing.length > 100) throw new BadRequestException('GROUP_CAP_REACHED');
      const allowedFriends = new Set(friendships.map(f =>
        f.requesterId === userId ? f.addresseeId : f.requesterId));
      if (fresh.some(id => !allowedFriends.has(id))) {
        throw new ForbiddenException('GROUP_ADD_FRIENDS_ONLY');
      }
      if (fresh.length) {
        await tx.conversationMember.createMany({
          data: fresh.map(id => ({
            conversationId, userId: id, role: ConversationRole.MEMBER
          })),
          skipDuplicates: true
        });
      }
      return { added: fresh.length };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async setRole(userId: string, conversationId: string, targetId: string, newRole: 'ADMIN' | 'MEMBER') {
    if (newRole !== 'ADMIN' && newRole !== 'MEMBER') throw new BadRequestException('GROUP_ROLE_INVALID');
    return this.prisma.$transaction(async tx => {
      await this.actor(tx, userId, conversationId, [ConversationRole.OWNER]);
      const target = await tx.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId, userId: targetId } },
        select: { role: true }
      });
      if (!target) throw new NotFoundException('GROUP_MEMBER_NOT_FOUND');
      if (target.role === ConversationRole.OWNER) throw new ForbiddenException('GROUP_OWNER_PROTECTED');
      return tx.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: targetId } },
        data: { role: newRole === 'ADMIN' ? ConversationRole.ADMIN : ConversationRole.MEMBER },
        select: { userId: true, role: true }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async removeMember(userId: string, conversationId: string, targetId: string) {
    await this.prisma.$transaction(async tx => {
      const actorRole = await this.actor(tx, userId, conversationId,
        [ConversationRole.OWNER, ConversationRole.ADMIN, ConversationRole.MEMBER]);
      const target = await tx.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId, userId: targetId } },
        select: { role: true }
      });
      if (!target) throw new NotFoundException('GROUP_MEMBER_NOT_FOUND');
      if (target.role === ConversationRole.OWNER) throw new ForbiddenException('GROUP_OWNER_PROTECTED');
      if (userId !== targetId) {
        if (actorRole !== ConversationRole.OWNER &&
          !(actorRole === ConversationRole.ADMIN && target.role === ConversationRole.MEMBER)) {
          throw new ForbiddenException('GROUP_PERMISSION_DENIED');
        }
      }
      await tx.conversationMember.delete({
        where: { conversationId_userId: { conversationId, userId: targetId } }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    // Membership revocation must evict open sockets; room membership otherwise
    // survives the database removal and leaks subsequent real-time messages.
    await this.realtime.revokeConversationAccess(conversationId, targetId);
    return { removed: true, userId: targetId };
  }
}
