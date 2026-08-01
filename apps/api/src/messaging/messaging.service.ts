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
                id: true, username: true, displayName: true, avatarUrl: true
              }
            }
          }
        },
        messages: { take: 1, orderBy: { createdAt: 'desc' } }
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async send(userId: string, conversationId: string, content: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } }
    });

    if (!member) {
      throw new ForbiddenException('Accès interdit à cette conversation.');
    }

    const message = await this.prisma.message.create({
      data: { conversationId, senderId: userId, content },
      include: {
        sender: {
          select: {
            id: true, username: true, displayName: true, avatarUrl: true
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
}
