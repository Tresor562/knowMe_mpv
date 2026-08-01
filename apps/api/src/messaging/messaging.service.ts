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
      include: { members: true }
    });
  }

  list(userId: string) {
    return this.prisma.conversation.findMany({
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
        messages: { take: 1, orderBy: { createdAt: 'desc' } }
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async history(
    userId: string,
    conversationId: string,
    cursor?: string,
    limit = 30
  ) {
    await this.assertMember(userId, conversationId);

    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      take: safeLimit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
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

    const hasMore = messages.length > safeLimit;
    const items = hasMore ? messages.slice(0, safeLimit) : messages;

    return {
      items: items.reverse(),
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null
    };
  }

  async send(userId: string, conversationId: string, content: string) {
    await this.assertMember(userId, conversationId);

    const message = await this.prisma.message.create({
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

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
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
  }
}
