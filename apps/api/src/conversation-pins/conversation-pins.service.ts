import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const MAX_PINNED_CONVERSATIONS = 5;

@Injectable()
export class ConversationPinsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const [pins, memberships] = await Promise.all([
      this.prisma.conversationPin.findMany({
        where: { userId },
        orderBy: [{ pinnedAt: 'desc' }, { conversationId: 'asc' }]
      }),
      this.prisma.conversationMember.findMany({
        where: { userId },
        select: { conversationId: true }
      })
    ]);

    const allowed = new Set(memberships.map((membership) => membership.conversationId));
    const stale = pins.filter((pin) => !allowed.has(pin.conversationId));
    if (stale.length) {
      await this.prisma.conversationPin.deleteMany({
        where: {
          userId,
          conversationId: { in: stale.map((pin) => pin.conversationId) }
        }
      });
    }

    const items = pins.filter((pin) => allowed.has(pin.conversationId));
    const remaining = Math.max(0, MAX_PINNED_CONVERSATIONS - items.length);

    return {
      limit: MAX_PINNED_CONVERSATIONS,
      remaining,
      canPinMore: remaining > 0,
      items
    };
  }

  async pin(userId: string, conversationId: string) {
    await this.requireMembership(userId, conversationId);

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT 1 FROM "User" WHERE "id" = ${userId} FOR UPDATE`);

      const existing = await tx.conversationPin.findUnique({
        where: { userId_conversationId: { userId, conversationId } }
      });
      if (existing) {
        return existing;
      }

      const count = await tx.conversationPin.count({ where: { userId } });
      if (count >= MAX_PINNED_CONVERSATIONS) {
        throw new ConflictException('CONVERSATION_PIN_LIMIT_REACHED');
      }

      return tx.conversationPin.create({
        data: { userId, conversationId }
      });
    });
  }

  async unpin(userId: string, conversationId: string) {
    const deleted = await this.prisma.conversationPin.deleteMany({
      where: { userId, conversationId }
    });
    return { unpinned: deleted.count > 0 };
  }

  private async requireMembership(userId: string, conversationId: string) {
    const membership = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { id: true }
    });
    if (!membership) {
      throw new NotFoundException('CONVERSATION_PIN_TARGET_NOT_FOUND');
    }
  }
}
