import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
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
        orderBy: [{ position: 'desc' }, { pinnedAt: 'desc' }, { conversationId: 'asc' }]
      }),
      this.prisma.conversationMember.findMany({
        where: { userId },
        select: { conversationId: true }
      })
    ]);

    const allowed = new Set(memberships.map((membership) => membership.conversationId));
    const stale = pins.filter((pin) => !allowed.has(pin.conversationId));
    let items = pins.filter((pin) => allowed.has(pin.conversationId));

    if (stale.length) {
      const normalizedPositions = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT 1 FROM "User" WHERE "id" = ${userId} FOR UPDATE`);
        await tx.conversationPin.deleteMany({
          where: {
            userId,
            conversationId: { in: stale.map((pin) => pin.conversationId) }
          }
        });
        return this.compactPositions(tx, userId);
      });

      items = items.map((pin) => ({
        ...pin,
        position: normalizedPositions.get(pin.conversationId) ?? pin.position
      }));
    }

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
        data: { userId, conversationId, position: count }
      });
    });
  }

  async reorder(
    userId: string,
    conversationIds: string[],
    expectedConversationIds?: string[]
  ) {
    if (conversationIds.length > MAX_PINNED_CONVERSATIONS) {
      throw new BadRequestException('CONVERSATION_PIN_ORDER_TOO_LARGE');
    }
    if (new Set(conversationIds).size !== conversationIds.length) {
      throw new BadRequestException('CONVERSATION_PIN_ORDER_DUPLICATE');
    }
    if (expectedConversationIds) {
      if (expectedConversationIds.length > MAX_PINNED_CONVERSATIONS) {
        throw new BadRequestException('CONVERSATION_PIN_EXPECTED_ORDER_TOO_LARGE');
      }
      if (new Set(expectedConversationIds).size !== expectedConversationIds.length) {
        throw new BadRequestException('CONVERSATION_PIN_EXPECTED_ORDER_DUPLICATE');
      }
    }

    const memberships = await this.prisma.conversationMember.findMany({
      where: { userId, conversationId: { in: conversationIds } },
      select: { conversationId: true }
    });
    if (memberships.length !== conversationIds.length) {
      throw new NotFoundException('CONVERSATION_PIN_ORDER_TARGET_NOT_FOUND');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT 1 FROM "User" WHERE "id" = ${userId} FOR UPDATE`);

      const current = await tx.conversationPin.findMany({
        where: { userId },
        select: { conversationId: true },
        orderBy: [{ position: 'desc' }, { pinnedAt: 'desc' }, { conversationId: 'asc' }]
      });
      const currentIds = new Set(current.map((pin) => pin.conversationId));
      if (
        current.length !== conversationIds.length ||
        conversationIds.some((conversationId) => !currentIds.has(conversationId))
      ) {
        throw new ConflictException('CONVERSATION_PIN_ORDER_STALE');
      }

      if (
        expectedConversationIds &&
        (expectedConversationIds.length !== current.length ||
          expectedConversationIds.some(
            (conversationId, index) => current[index]?.conversationId !== conversationId
          ))
      ) {
        throw new ConflictException('CONVERSATION_PIN_ORDER_STALE');
      }

      await Promise.all(
        conversationIds.map((conversationId, index) =>
          tx.conversationPin.update({
            where: { userId_conversationId: { userId, conversationId } },
            data: { position: conversationIds.length - index - 1 }
          })
        )
      );

      return { reordered: true, conversationIds };
    });
  }

  async unpin(userId: string, conversationId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT 1 FROM "User" WHERE "id" = ${userId} FOR UPDATE`);
      const deleted = await tx.conversationPin.deleteMany({
        where: { userId, conversationId }
      });
      if (deleted.count > 0) {
        await this.compactPositions(tx, userId);
      }
      return { unpinned: deleted.count > 0 };
    });
  }

  private async compactPositions(tx: Prisma.TransactionClient, userId: string) {
    const current = await tx.conversationPin.findMany({
      where: { userId },
      select: { conversationId: true, position: true },
      orderBy: [{ position: 'desc' }, { pinnedAt: 'desc' }, { conversationId: 'asc' }]
    });
    const positions = new Map<string, number>();

    await Promise.all(
      current.map((pin, index) => {
        const position = current.length - index - 1;
        positions.set(pin.conversationId, position);
        if (pin.position === position) {
          return Promise.resolve(pin);
        }
        return tx.conversationPin.update({
          where: { userId_conversationId: { userId, conversationId: pin.conversationId } },
          data: { position }
        });
      })
    );

    return positions;
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
