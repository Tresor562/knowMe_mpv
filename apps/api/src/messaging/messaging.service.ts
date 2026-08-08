import { ForbiddenException, Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateConversationDto } from './dto/create-conversation.dto';
import {
  StickerPresentation,
  StickerTokenService
} from './stickers/sticker-token.service';

const NEXUS_AUTHOR = {
  id: 'nexus.ai',
  username: 'nexus_ai',
  displayName: 'Nexus',
  avatarUrl: null
} as const;

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
    private readonly stickerTokens: StickerTokenService
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
        const membership = conversation.members.find(
          (member) => member.userId === userId
        );
        const [humanUnread, nexusUnread, latestNexus] = membership
          ? await Promise.all([
              this.prisma.message.count({
                where: {
                  conversationId: conversation.id,
                  senderId: { not: userId },
                  createdAt: { gt: membership.lastReadAt }
                }
              }),
              this.prisma.nexusSocialReply.count({
                where: {
                  conversationId: conversation.id,
                  createdAt: { gt: membership.lastReadAt }
                }
              }),
              this.prisma.nexusSocialReply.findFirst({
                where: { conversationId: conversation.id },
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
              })
            ])
          : [0, 0, null] as const;

        const latestHuman = conversation.messages[0]
          ? this.presentMessage(conversation.messages[0])
          : null;
        const latestAssistant = latestNexus
          ? this.presentNexusReply(latestNexus)
          : null;
        const latest = !latestHuman
          ? latestAssistant
          : !latestAssistant
            ? latestHuman
            : new Date(latestAssistant.createdAt).getTime() > new Date(latestHuman.createdAt).getTime()
              ? latestAssistant
              : latestHuman;

        return {
          ...conversation,
          messages: latest ? [latest] : [],
          unreadCount: humanUnread + nexusUnread,
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
      memberships.map(async (membership) => {
        const [human, nexus] = await Promise.all([
          this.prisma.message.count({
            where: {
              conversationId: membership.conversationId,
              senderId: { not: userId },
              createdAt: { gt: membership.lastReadAt }
            }
          }),
          this.prisma.nexusSocialReply.count({
            where: {
              conversationId: membership.conversationId,
              createdAt: { gt: membership.lastReadAt }
            }
          })
        ]);
        return human + nexus;
      })
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
    const cursorDate = cursor
      ? await this.resolveTimelineCursor(conversationId, cursor)
      : null;
    const before = cursorDate ? { lt: cursorDate } : undefined;
    const [messages, nexusReplies, members] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId, ...(before ? { createdAt: before } : {}) },
        take: safeLimit + 1,
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
      this.prisma.nexusSocialReply.findMany({
        where: { conversationId, ...(before ? { createdAt: before } : {}) },
        take: safeLimit + 1,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
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

    const timeline = [
      ...messages.map((message) => this.presentMessage(message)),
      ...nexusReplies.map((message) => this.presentNexusReply(message))
    ].sort((a, b) => {
      const time = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return time || b.id.localeCompare(a.id);
    });
    const hasMore = timeline.length > safeLimit;
    const pageDescending = timeline.slice(0, safeLimit);
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

    const [latestHuman, latestNexus] = await Promise.all([
      this.prisma.message.findFirst({
        where: { conversationId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { createdAt: true }
      }),
      this.prisma.nexusSocialReply.findFirst({
        where: { conversationId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { createdAt: true }
      })
    ]);
    const humanAt = latestHuman?.createdAt?.getTime() ?? 0;
    const nexusAt = latestNexus?.createdAt?.getTime() ?? 0;
    const lastReadAt = humanAt || nexusAt
      ? new Date(Math.max(humanAt, nexusAt))
      : new Date();

    const membership = await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt },
      select: { conversationId: true, userId: true, lastReadAt: true }
    });

    await this.realtime.emitConversationRead(conversationId, membership);
    return { ...membership, unread: 0 };
  }

  async send(userId: string, conversationId: string, content: string) {
    await this.assertMember(userId, conversationId);
    return this.sendAuthorized(userId, conversationId, content);
  }

  async sendSticker(input: {
    userId: string;
    conversationId: string;
    packKey: string;
    stickerKey: string;
  }) {
    await this.assertMember(input.userId, input.conversationId);
    const content = this.stickerTokens.create({
      conversationId: input.conversationId,
      packKey: input.packKey,
      stickerKey: input.stickerKey
    });
    return this.sendAuthorized(input.userId, input.conversationId, content);
  }

  private async sendAuthorized(
    userId: string,
    conversationId: string,
    content: string
  ) {
    const { message, recipients } = await this.prisma.$transaction(async (tx) => {
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

      const conversationRecipients = await tx.conversationMember.findMany({
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
        })
      ]);

      return { message: created, recipients: conversationRecipients };
    });

    const sticker = this.stickerTokens.resolve(content, { conversationId });
    const preview = sticker
      ? `Sticker : ${sticker.sticker.label}`
      : content.length > 120
        ? `${content.slice(0, 117)}…`
        : content;
    const presented = this.presentMessage(message, sticker);

    await Promise.all([
      recipients.length
        ? this.notifications.createMany(
            recipients.map((recipient) => ({
              userId: recipient.userId,
              type: 'MESSAGE',
              title: `Nouveau message de ${message.sender.displayName}`,
              body: preview,
              data: {
                route: `/messages/${conversationId}`,
                entityType: 'CONVERSATION',
                entityId: conversationId,
                messageId: message.id,
                actorId: userId,
                messageKind: sticker ? 'STICKER' : 'TEXT'
              }
            }))
          )
        : Promise.resolve([]),
      this.realtime.emitMessageCreated(conversationId, presented),
      this.realtime.emitConversationRead(conversationId, {
        userId,
        lastReadAt: message.createdAt
      })
    ]);

    return presented;
  }

  private presentMessage<T extends { content: string; conversationId: string }>(
    message: T,
    knownSticker?: StickerPresentation | null
  ) {
    const sticker =
      knownSticker ??
      this.stickerTokens.resolve(message.content, {
        conversationId: message.conversationId
      });
    return {
      ...message,
      presentation: sticker ?? {
        kind: 'TEXT' as const,
        text: message.content
      }
    };
  }

  private presentNexusReply(message: {
    id: string;
    requestId: string;
    conversationId: string;
    content: string;
    surface: string;
    provider: string | null;
    model: string | null;
    route: string | null;
    createdAt: Date;
  }) {
    return {
      id: `nexus:${message.id}`,
      sourceId: message.id,
      conversationId: message.conversationId,
      content: message.content,
      createdAt: message.createdAt,
      editedAt: null,
      senderId: NEXUS_AUTHOR.id,
      sender: NEXUS_AUTHOR,
      nexusAuthored: true,
      nexus: {
        requestId: message.requestId,
        surface: message.surface,
        provider: message.provider,
        model: message.model,
        route: message.route
      },
      presentation: {
        kind: 'TEXT' as const,
        text: message.content
      }
    };
  }

  private async resolveTimelineCursor(conversationId: string, cursor: string) {
    if (cursor.startsWith('nexus:')) {
      const row = await this.prisma.nexusSocialReply.findFirst({
        where: { id: cursor.slice(6), conversationId },
        select: { createdAt: true }
      });
      if (!row) throw new ForbiddenException('Invalid conversation cursor.');
      return row.createdAt;
    }
    const row = await this.prisma.message.findFirst({
      where: { id: cursor, conversationId },
      select: { createdAt: true }
    });
    if (!row) throw new ForbiddenException('Invalid conversation cursor.');
    return row.createdAt;
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
