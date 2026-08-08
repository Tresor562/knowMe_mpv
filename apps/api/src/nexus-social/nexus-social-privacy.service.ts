import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NexusSocialPrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  async exportForAccount(userId: string) {
    const [privateConversation, accountLink, invokedReplies] = await Promise.all([
      this.prisma.nexusSocialConversation.findUnique({ where: { ownerUserId: userId } }),
      this.prisma.nexusAccountLink.findUnique({
        where: { knowMeUserId: userId },
        select: {
          nexusUserId: true,
          lastPlan: true,
          lastStatus: true,
          verifiedAt: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      this.prisma.nexusSocialReply.findMany({
        where: { invokingUserId: userId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          requestId: true,
          conversationId: true,
          sourceMessageId: true,
          surface: true,
          invocationKind: true,
          content: true,
          provider: true,
          model: true,
          route: true,
          fallbackUsed: true,
          createdAt: true
        },
        take: 5_000
      })
    ]);

    return {
      exportedAt: new Date().toISOString(),
      nexusAccountLink: accountLink,
      privateConversation: privateConversation
        ? {
            conversationId: privateConversation.conversationId,
            createdAt: privateConversation.createdAt,
            updatedAt: privateConversation.updatedAt
          }
        : null,
      invokedReplies
    };
  }

  async deletePrivateConversation(userId: string) {
    const row = await this.prisma.nexusSocialConversation.findUnique({ where: { ownerUserId: userId } });
    if (!row) return { deleted: false };

    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: row.conversationId, userId } },
      select: { id: true }
    });
    if (!member) throw new ForbiddenException('Private Nexus conversation ownership is inconsistent.');

    await this.prisma.$transaction(async (tx) => {
      await tx.nexusSocialReply.deleteMany({ where: { conversationId: row.conversationId } });
      await tx.nexusSocialConversation.delete({ where: { id: row.id } });
      await tx.conversation.delete({ where: { id: row.conversationId } });
    });
    return { deleted: true };
  }

  async purgeForDeletedAccount(userId: string) {
    const privateConversation = await this.prisma.nexusSocialConversation.findUnique({
      where: { ownerUserId: userId },
      select: { id: true, conversationId: true }
    });

    return this.prisma.$transaction(async (tx) => {
      const [invokedReplies, accountLinks] = await Promise.all([
        tx.nexusSocialReply.deleteMany({ where: { invokingUserId: userId } }),
        tx.nexusAccountLink.deleteMany({ where: { knowMeUserId: userId } })
      ]);

      if (!privateConversation) {
        return {
          invokedRepliesDeleted: invokedReplies.count,
          nexusAccountLinksDeleted: accountLinks.count,
          privateRepliesDeleted: 0,
          privateConversationDeleted: false
        };
      }

      const privateReplies = await tx.nexusSocialReply.deleteMany({ where: { conversationId: privateConversation.conversationId } });
      await tx.nexusSocialConversation.deleteMany({ where: { id: privateConversation.id } });
      await tx.conversation.deleteMany({ where: { id: privateConversation.conversationId } });

      return {
        invokedRepliesDeleted: invokedReplies.count,
        nexusAccountLinksDeleted: accountLinks.count,
        privateRepliesDeleted: privateReplies.count,
        privateConversationDeleted: true
      };
    });
  }
}
