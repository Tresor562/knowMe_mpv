import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConversationRole } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { staffAccountSelect, toStaffBadge, type StaffProfileRecord } from '../staff/staff-profile';

const publicSenderSelect = {
  id:true, username:true, displayName:true, avatarUrl:true,
  email:true, staffAccount:{select:staffAccountSelect}
} as const;

function toPublicSender<T extends {email?:string|null;staffAccount?:StaffProfileRecord}>(user:T) {
  const {email,staffAccount,...profile}=user;
  return {...profile,staff:toStaffBadge(staffAccount??null,email)};
}

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

  async createConversation(userId: string, dto: CreateConversationDto) {
    const memberIds = [...new Set([userId, ...dto.memberIds])];

    const conversation = await this.prisma.conversation.create({
      data: {
        title: dto.title,
        isGroup: memberIds.length > 2,
        members: { create: memberIds.map((id) => ({ userId: id,
          role: memberIds.length > 2 && id === userId ? ConversationRole.OWNER : ConversationRole.MEMBER })) }
      },
      include: {
        members: {
          include: {
            user: {
              select: publicSenderSelect
            }
          }
        }
      }
    });
  }

    return {...conversation,members:conversation.members.map(member=>({...member,user:toPublicSender(member.user)}))};
  }

  async list(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: {
          include: {
            user: {
              select: publicSenderSelect
            }
          }
        },
        messages: {
          take: 1,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: {
            sender: {
              select: publicSenderSelect
            },
            mediaAsset: { select: { id: true, detectedMime: true, originalName: true, size: true, status: true, deletedAt: true } }
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
          members:conversation.members.map(member=>({...member,user:toPublicSender(member.user)})),
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
    const cursorPoint = cursor
      ? await this.resolveTimelineCursor(conversationId, cursor)
      : null;

    const messageWhere = cursorPoint
      ? {
          conversationId,
          OR: [
            { createdAt: { lt: cursorPoint.createdAt } },
            ...(cursorPoint.source === 'human'
              ? [
                  {
                    createdAt: cursorPoint.createdAt,
                    id: { lt: cursorPoint.sourceId }
                  }
                ]
              : [])
          ]
        }
      : { conversationId };

    const nexusWhere = cursorPoint
      ? {
          conversationId,
          OR: [
            { createdAt: { lt: cursorPoint.createdAt } },
            ...(cursorPoint.source === 'human'
              ? [{ createdAt: cursorPoint.createdAt }]
              : [
                  {
                    createdAt: cursorPoint.createdAt,
                    id: { lt: cursorPoint.sourceId }
                  }
                ])
          ]
        }
      : { conversationId };

    const [messages, nexusReplies, members] = await Promise.all([
      this.prisma.message.findMany({
        where: messageWhere,
        take: safeLimit + 1,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          sender: {
            select: publicSenderSelect
          },
          mediaAsset: { select: { id: true, detectedMime: true, originalName: true, size: true, status: true, deletedAt: true } }
        }
      }),
      this.prisma.nexusSocialReply.findMany({
        where: nexusWhere,
        take: safeLimit + 1,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
      }),
      this.prisma.conversationMember.findMany({
        where: { conversationId },
        select: {
          userId: true,
          lastReadAt: true,
          user: {
            select: publicSenderSelect
          }
        }
      })
    ]);

    const timeline = [
      ...messages.map((message) => this.presentMessage(message)),
      ...nexusReplies.map((message) => this.presentNexusReply(message))
    ].sort((a, b) => this.compareTimelineItems(a, b));
    const hasMore = timeline.length > safeLimit;
    const pageDescending = timeline.slice(0, safeLimit);
    const nextCursor = hasMore
      ? pageDescending[pageDescending.length - 1]?.id ?? null
      : null;

    return {
      items: [...pageDescending].reverse(),
      nextCursor,
      readStates: members.map(member=>({...member,user:toPublicSender(member.user)}))
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

  async sendMediaMessage(
    userId: string, conversationId: string, assetId: string,
    kind: 'GIF' | 'STICKER_IMAGE' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'
  ) {
    await this.assertMember(userId, conversationId);
    const acceptableMime = kind === 'GIF' ? ['image/gif'] :
      kind === 'STICKER_IMAGE' ? ['image/png', 'image/webp'] :
      kind === 'IMAGE' ? ['image/jpeg', 'image/png', 'image/webp'] :
      kind === 'VIDEO' ? ['video/mp4'] :
      kind === 'AUDIO' ? ['audio/mpeg', 'audio/ogg', 'audio/wav'] : ['application/pdf'];
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: assetId, ownerId: userId, conversationId,
        purpose: 'MESSAGE', visibility: 'CONVERSATION',
        status: 'AVAILABLE', scannerVerdict: 'CLEAN',
        deletedAt: null, detectedMime: { in: acceptableMime } },
      select: { id: true }
    });
    if (!asset) throw new ForbiddenException('Média indisponible ou non autorisé pour cette conversation.');
    return this.sendAuthorized(userId, conversationId, kind, asset.id);
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
    content: string,
    mediaAssetId?: string
  ) {
    const { message, recipients } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: { conversationId, senderId: userId, content, mediaAssetId: mediaAssetId ?? null },
        include: {
          sender: {
            select: publicSenderSelect
          },
          mediaAsset: { select: { id: true, detectedMime: true, originalName: true, size: true, status: true, deletedAt: true } }
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
      : mediaAssetId ? ({GIF:'GIF',STICKER_IMAGE:'Sticker',IMAGE:'Image',VIDEO:'Vidéo',AUDIO:'Audio',DOCUMENT:'Document'} as Record<string,string>)[content] ?? 'Pièce jointe'
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
                messageKind: mediaAssetId ? content : sticker ? 'STICKER' : 'TEXT'
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

  private presentMessage<T extends {
    content: string; conversationId: string;
    mediaAsset?: { id: string; detectedMime: string; originalName: string; size: number; status: string; deletedAt: Date | null } | null;
  }>(
    message: T,
    knownSticker?: StickerPresentation | null
  ) {
    const sticker =
      knownSticker ??
      this.stickerTokens.resolve(message.content, {
        conversationId: message.conversationId
      });
    const asset = message.mediaAsset;
    const available = asset?.status === 'AVAILABLE' && !asset.deletedAt;
    const mediaPresentation = available && asset && (
      (message.content === 'GIF' && asset.detectedMime === 'image/gif') ||
      (message.content === 'STICKER_IMAGE' && ['image/png', 'image/webp'].includes(asset.detectedMime)) ||
      (message.content === 'IMAGE' && ['image/jpeg', 'image/png', 'image/webp'].includes(asset.detectedMime)) ||
      (message.content === 'VIDEO' && asset.detectedMime === 'video/mp4') ||
      (message.content === 'AUDIO' && ['audio/mpeg', 'audio/ogg', 'audio/wav'].includes(asset.detectedMime)) ||
      (message.content === 'DOCUMENT' && asset.detectedMime === 'application/pdf')
    ) ? { kind: message.content as 'GIF' | 'STICKER_IMAGE' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT',
      assetId: asset.id, mimeType: asset.detectedMime, fileName: asset.originalName, sizeBytes: asset.size } : null;
    const sender = (message as T & {sender?:{email?:string|null;staffAccount?:StaffProfileRecord}}).sender;
    return {
      ...message,
      ...(sender ? {sender:toPublicSender(sender)} : {}),
      presentation: mediaPresentation ?? sticker ?? {
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

  private compareTimelineItems(
    a: {
      id: string;
      createdAt: Date;
      nexusAuthored?: boolean;
      sourceId?: string;
    },
    b: {
      id: string;
      createdAt: Date;
      nexusAuthored?: boolean;
      sourceId?: string;
    }
  ) {
    const time = b.createdAt.getTime() - a.createdAt.getTime();
    if (time) return time;

    const aSourceRank = a.nexusAuthored ? 1 : 0;
    const bSourceRank = b.nexusAuthored ? 1 : 0;
    if (aSourceRank !== bSourceRank) return aSourceRank - bSourceRank;

    const aId = a.sourceId ?? a.id;
    const bId = b.sourceId ?? b.id;
    if (aId === bId) return 0;
    return aId < bId ? 1 : -1;
  }

  private async resolveTimelineCursor(conversationId: string, cursor: string) {
    if (cursor.startsWith('nexus:')) {
      const row = await this.prisma.nexusSocialReply.findFirst({
        where: { id: cursor.slice(6), conversationId },
        select: { id: true, createdAt: true }
      });
      if (!row) throw new ForbiddenException('Invalid conversation cursor.');
      return {
        source: 'nexus' as const,
        sourceId: row.id,
        createdAt: row.createdAt
      };
    }
    const row = await this.prisma.message.findFirst({
      where: { id: cursor, conversationId },
      select: { id: true, createdAt: true }
    });
    if (!row) throw new ForbiddenException('Invalid conversation cursor.');
    return {
      source: 'human' as const,
      sourceId: row.id,
      createdAt: row.createdAt
    };
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
