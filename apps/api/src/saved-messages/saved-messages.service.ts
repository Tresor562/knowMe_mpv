import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SavedMessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async save(userId: string, messageId: string) {
    const message = await this.authorizedMessage(userId, messageId);
    if (!message) throw new NotFoundException('SAVED_MESSAGE_SOURCE_NOT_FOUND');

    const saved = await this.prisma.savedMessage.upsert({
      where: { userId_messageId: { userId, messageId } },
      create: { userId, messageId },
      update: {}
    });

    return {
      messageId: saved.messageId,
      savedAt: saved.savedAt,
      message
    };
  }

  async list(userId: string, rawLimit = 50) {
    const limit = Math.min(Math.max(rawLimit, 1), 100);
    const saved = await this.prisma.savedMessage.findMany({
      where: { userId },
      orderBy: [{ savedAt: 'desc' }, { messageId: 'desc' }],
      take: limit
    });

    if (!saved.length) return { items: [] };

    const visibleMessages = await this.prisma.message.findMany({
      where: {
        id: { in: saved.map((item) => item.messageId) },
        conversation: { members: { some: { userId } } }
      },
      select: {
        id: true,
        conversationId: true,
        content: true,
        createdAt: true,
        editedAt: true,
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
    const byId = new Map(visibleMessages.map((message) => [message.id, message]));

    return {
      items: saved.flatMap((item) => {
        const message = byId.get(item.messageId);
        return message ? [{ messageId: item.messageId, savedAt: item.savedAt, message }] : [];
      })
    };
  }

  async remove(userId: string, messageId: string) {
    const result = await this.prisma.savedMessage.deleteMany({
      where: { userId, messageId }
    });
    return { removed: result.count > 0 };
  }

  async exportForAccount(userId: string) {
    return this.prisma.savedMessage.findMany({
      where: { userId },
      orderBy: [{ savedAt: 'desc' }, { messageId: 'desc' }]
    });
  }

  private authorizedMessage(userId: string, messageId: string) {
    return this.prisma.message.findFirst({
      where: {
        id: messageId,
        conversation: { members: { some: { userId } } }
      },
      select: {
        id: true,
        conversationId: true,
        content: true,
        createdAt: true,
        editedAt: true,
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
  }
}
