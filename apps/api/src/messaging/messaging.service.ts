import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateConversationDto } from './dto/create-conversation.dto';

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway
  ) {}

  createConversation(userId: string, dto: CreateConversationDto) {
    const memberIds = [...new Set([userId, ...dto.memberIds])];

    return this.prisma.conversation.create({
      data: {
        title: dto.title,
        isGroup: memberIds.length > 2,
        members: { create: memberIds.map((id) => ({ userId: id })) }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true
              }
            }
          }
        }
      }
    });
  }

  async list(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true
              }
            }
          }
        },
        messages: {
          take: 1,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true
              }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return Promise.all(
      conversations.map(async (conversation) => {
        const membership = conversation.members.find((member) => member.userId === userId);
        const unreadCount = membership
          ? await this.prisma.message.count({
              where: {
                conversationId: conversation.id,
                senderId: { not: userId },
                createdAt: { gt: membership.lastReadAt }
              }
            })
          : 0;

        return {
          ...conversation,
          unreadCount,
          lastReadAt: membership?.lastReadAt ?? null
        };
      })
    );
  }

  async unreadCount(userId: string) {
    const memberships = await this.prisma.conversationMember.findMany({
      where: { userId },
      select: {
        conversationId: true,
        lastReadAt: true
      }
    });

    const counts = await Promise.all(
      memberships.map((membership) =>
        this.prisma.message.count({
          where: {
            conversationId: membership.conversationId,
            senderId: { not: userId },
            createdAt: { gt: membership.lastReadAt }
          }
        })
      )
    );

    return { unread: counts.reduce((total, count) => total + count, 0) };
  }

  async history(
    userId: string,
    conversationId: string,
    cursor?: string,
    limit = 30
  ) {
    await this.assertMember(userId, conversationId);

    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const [messages, members] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        take: safeLimit + 1,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true
            }
          }
        }
      }),
      this.prisma.conversationMember.findMany({
        where: { conversationId },
        select: {
          userId: true,
          lastReadAt: true,
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true
            }
          }
        }
      })
    ]);

    const hasMore = messages.length > safeLimit;
    const pageDescending = hasMore ? messages.slice(0, safeLimit) : messages;
    const nextCursor = hasMore
      ? pageDescending[pageDescending.length - 1]?.id ?? null
      : null;

    return {
      items: [...pageDescending].reverse(),
      nextCursor,
      readStates: members
    };
  }

  async markRead(userId: string, conversationId: string) {
    await this.assertMember(userId, conversationId);

    const latest = await this.prisma.message.findFirst({
      where: { conversationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { createdAt: true }
    });

    const membership = await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: latest?.createdAt ?? new Date() },
      select: { conversationId: true, userId: true, lastReadAt: true }
    });

    return { ...membership, unread: 0 };
  }

  async send(userId: string, conversationId: string, content: string) {
    await this.assertMember(userId, conversationId);

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: { conversationId, senderId: userId, content },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true
            }
          }
        }
      });

      const recipients = await tx.conversationMember.findMany({
        where: { conversationId, userId: { not: userId } },
        select: { userId: true }
      });

      await Promise.all([
        tx.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: created.createdAt }
        }),
        tx.conversationMember.update({
          where: { conversationId_userId: { conversationId, userId } },
          data: { lastReadAt: created.createdAt }
        }),
        recipients.length
          ? tx.notification.createMany({
              data: recipients.map((recipient) => ({
                userId: recipient.userId,
                type: 'MESSAGE',
                title: `Nouveau message de ${created.sender.displayName}`,
                body: content.length > 120 ? `${content.slice(0, 117)}…` : content
              }))
            })
          : Promise.resolve()
      ]);

      return created;
    });

    this.realtime.emitMessageCreated(conversationId, message);
    return message;
  }

  private async assertMember(userId: string, conversationId: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } }
    });

    if (!member) {
      throw new ForbiddenException('Accès interdit à cette conversation.');
    }

    return member;
  }
}
