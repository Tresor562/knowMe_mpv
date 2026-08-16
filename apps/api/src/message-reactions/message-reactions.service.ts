import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { STANDARD_MESSAGE_REACTIONS } from './dto/set-message-reaction.dto';

@Injectable()
export class MessageReactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway
  ) {}

  async list(userId: string, messageId: string) {
    const message = await this.visibleMessage(userId, messageId);
    if (!message) throw new NotFoundException('MESSAGE_REACTION_TARGET_NOT_FOUND');
    return this.snapshot(userId, message.conversationId, messageId);
  }

  async set(userId: string, messageId: string, emoji: string) {
    const message = await this.visibleMessage(userId, messageId);
    if (!message) throw new NotFoundException('MESSAGE_REACTION_TARGET_NOT_FOUND');

    await this.prisma.messageReaction.upsert({
      where: { userId_messageId: { userId, messageId } },
      create: { userId, messageId, emoji },
      update: { emoji }
    });

    const snapshot = await this.snapshot(userId, message.conversationId, messageId);
    await this.emit(message.conversationId, messageId);
    return snapshot;
  }

  async remove(userId: string, messageId: string) {
    const message = await this.visibleMessage(userId, messageId);
    if (!message) throw new NotFoundException('MESSAGE_REACTION_TARGET_NOT_FOUND');

    const deleted = await this.prisma.messageReaction.deleteMany({
      where: { userId, messageId }
    });
    const snapshot = await this.snapshot(userId, message.conversationId, messageId);
    if (deleted.count) await this.emit(message.conversationId, messageId);
    return { removed: deleted.count > 0, ...snapshot };
  }

  private async snapshot(userId: string, conversationId: string, messageId: string) {
    const [counts, mine] = await Promise.all([
      this.prisma.messageReaction.groupBy({
        by: ['emoji'],
        where: { messageId },
        _count: { _all: true }
      }),
      this.prisma.messageReaction.findUnique({
        where: { userId_messageId: { userId, messageId } },
        select: { emoji: true }
      })
    ]);
    const byEmoji = new Map(counts.map((item) => [item.emoji, item._count._all]));
    return {
      conversationId,
      messageId,
      myReaction: mine?.emoji ?? null,
      reactions: STANDARD_MESSAGE_REACTIONS.flatMap((emoji) => {
        const count = byEmoji.get(emoji) ?? 0;
        return count ? [{ emoji, count }] : [];
      })
    };
  }

  private async emit(conversationId: string, messageId: string) {
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true }
    });
    const counts = await this.prisma.messageReaction.groupBy({
      by: ['emoji'],
      where: { messageId },
      _count: { _all: true }
    });
    const byEmoji = new Map(counts.map((item) => [item.emoji, item._count._all]));
    const reactions = STANDARD_MESSAGE_REACTIONS.flatMap((emoji) => {
      const count = byEmoji.get(emoji) ?? 0;
      return count ? [{ emoji, count }] : [];
    });
    const rooms = [
      `conversation:${conversationId}`,
      ...members.map((member) => `user:${member.userId}`)
    ];
    this.realtime.server.to(rooms).emit('message:reactions', {
      conversationId,
      messageId,
      reactions
    });
  }

  private visibleMessage(userId: string, messageId: string) {
    return this.prisma.message.findFirst({
      where: {
        id: messageId,
        conversation: { members: { some: { userId } } }
      },
      select: { id: true, conversationId: true }
    });
  }
}
