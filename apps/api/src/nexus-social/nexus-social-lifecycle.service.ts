import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NexusSocialLifecycleService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.NEXUS_SOCIAL_MAINTENANCE_ENABLED === 'false') return;
    const intervalMs = this.boundedInteger(
      process.env.NEXUS_SOCIAL_MAINTENANCE_INTERVAL_MS,
      60_000,
      15_000,
      3_600_000
    );
    this.timer = setInterval(() => {
      void this.runOnce().catch((error) => {
        console.error(
          '[nexus-social] lifecycle cleanup failed',
          error instanceof Error ? error.message : error
        );
      });
    }, intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async runOnce() {
    const batchSize = this.boundedInteger(
      process.env.NEXUS_SOCIAL_MAINTENANCE_BATCH_SIZE,
      100,
      1,
      500
    );

    const privateRows = await this.prisma.nexusSocialConversation.findMany({
      take: batchSize,
      orderBy: { updatedAt: 'asc' }
    });
    let privateConversationsDeleted = 0;
    for (const row of privateRows) {
      const [owner, membership] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: row.ownerUserId }, select: { id: true } }),
        this.prisma.conversationMember.findUnique({
          where: {
            conversationId_userId: {
              conversationId: row.conversationId,
              userId: row.ownerUserId
            }
          },
          select: { id: true }
        })
      ]);
      if (owner && membership) continue;

      await this.prisma.$transaction(async (tx) => {
        await tx.nexusSocialReply.deleteMany({
          where: { conversationId: row.conversationId }
        });
        await tx.nexusSocialConversation.deleteMany({ where: { id: row.id } });
        const remaining = await tx.conversationMember.count({
          where: { conversationId: row.conversationId }
        });
        if (remaining === 0) {
          await tx.conversation.deleteMany({ where: { id: row.conversationId } });
        }
      });
      privateConversationsDeleted += 1;
    }

    const replies = await this.prisma.nexusSocialReply.findMany({
      take: batchSize,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        invokingUserId: true,
        sourceMessageId: true
      }
    });
    let repliesDeleted = 0;
    for (const reply of replies) {
      const [user, source] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: reply.invokingUserId },
          select: { id: true }
        }),
        this.prisma.message.findUnique({
          where: { id: reply.sourceMessageId },
          select: { id: true }
        })
      ]);
      if (user && source) continue;
      const result = await this.prisma.nexusSocialReply.deleteMany({
        where: { id: reply.id }
      });
      repliesDeleted += result.count;
    }

    return { privateConversationsDeleted, repliesDeleted };
  }

  private boundedInteger(
    raw: string | undefined,
    fallback: number,
    min: number,
    max: number
  ) {
    const value = Number(raw);
    return Number.isInteger(value) ? Math.max(min, Math.min(max, value)) : fallback;
  }
}
