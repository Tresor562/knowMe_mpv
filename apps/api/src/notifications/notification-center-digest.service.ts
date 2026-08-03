import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import {
  classifyNotificationType,
  notificationDigestSchedule,
  NotificationCenterPreferencePolicy
} from './notification-center.domain';

@Injectable()
export class NotificationCenterDigestService {
  private readonly logger = new Logger(NotificationCenterDigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway
  ) {}

  enqueue(input: {
    notificationId: string;
    userId: string;
    type: string;
    mode: 'HOURLY' | 'DAILY';
    preference: NotificationCenterPreferencePolicy;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const schedule = notificationDigestSchedule({
      mode: input.mode,
      now,
      timezone: input.preference.timezone,
      dailyDigestMinute: input.preference.dailyDigestMinute
    });
    return this.prisma.notificationCenterDigestQueueItem.upsert({
      where: { notificationId: input.notificationId },
      create: {
        notificationId: input.notificationId,
        userId: input.userId,
        category: classifyNotificationType(input.type),
        digestMode: input.mode,
        bucketKey: schedule.bucketKey,
        dueAt: schedule.dueAt
      },
      update: {}
    });
  }

  async flushDue(input: { limit?: number; now?: Date } = {}) {
    const now = input.now ?? new Date();
    const limit = Math.min(2_000, Math.max(1, input.limit ?? 500));
    await this.recoverStale(now);
    await this.retryFailed();

    const candidates =
      await this.prisma.notificationCenterDigestQueueItem.findMany({
        where: { status: 'PENDING', dueAt: { lte: now } },
        select: { userId: true, bucketKey: true },
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
        take: limit
      });
    const groups = [
      ...new Map(
        candidates.map((item) => [`${item.userId}\u0000${item.bucketKey}`, item])
      ).values()
    ];

    let batches = 0;
    let notifications = 0;
    let items = 0;
    let failed = 0;

    for (const group of groups) {
      const token = randomUUID();
      await this.prisma.notificationCenterDigestQueueItem.updateMany({
        where: {
          userId: group.userId,
          bucketKey: group.bucketKey,
          status: 'PENDING',
          dueAt: { lte: now }
        },
        data: {
          status: 'PROCESSING',
          processingToken: token,
          processingAt: now,
          attempts: { increment: 1 },
          lastError: null
        }
      });
      const claimed =
        await this.prisma.notificationCenterDigestQueueItem.findMany({
          where: { processingToken: token, status: 'PROCESSING' },
          orderBy: { createdAt: 'asc' }
        });
      if (!claimed.length) continue;

      try {
        const result = await this.createBatch({
          userId: group.userId,
          bucketKey: group.bucketKey,
          queueItems: claimed,
          now
        });
        batches += 1;
        items += claimed.length;
        if (result.created) notifications += 1;
      } catch (error) {
        const code =
          error instanceof Error ? error.message.slice(0, 160) : 'UNKNOWN_ERROR';
        this.logger.error(`Digest batch ${group.bucketKey} failed: ${code}`);
        await this.prisma.notificationCenterDigestQueueItem.updateMany({
          where: { processingToken: token },
          data: {
            status: 'FAILED',
            processingToken: null,
            processingAt: null,
            lastError: code
          }
        });
        failed += claimed.length;
      }
    }

    return { batches, notifications, items, failed, serverTime: now };
  }

  async dashboard(now = new Date()) {
    const [pending, processing, failed, due, recentBatches] = await Promise.all([
      this.prisma.notificationCenterDigestQueueItem.count({
        where: { status: 'PENDING' }
      }),
      this.prisma.notificationCenterDigestQueueItem.count({
        where: { status: 'PROCESSING' }
      }),
      this.prisma.notificationCenterDigestQueueItem.count({
        where: { status: 'FAILED' }
      }),
      this.prisma.notificationCenterDigestQueueItem.count({
        where: { status: 'PENDING', dueAt: { lte: now } }
      }),
      this.prisma.notificationCenterDigestBatch.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20
      })
    ]);
    return { pending, processing, failed, due, recentBatches, serverTime: now };
  }

  private async createBatch(input: {
    userId: string;
    bucketKey: string;
    queueItems: Array<{
      notificationId: string;
      digestMode: 'INSTANT' | 'HOURLY' | 'DAILY' | 'CENTER_ONLY';
      category: string;
    }>;
    now: Date;
  }) {
    const ids = input.queueItems.map((item) => item.notificationId);
    const originals = await this.prisma.notification.findMany({
      where: { id: { in: ids }, userId: input.userId },
      orderBy: { createdAt: 'asc' }
    });
    const mode = input.queueItems[0]?.digestMode;
    if (mode !== 'HOURLY' && mode !== 'DAILY') {
      throw new Error('NOTIFICATION_CENTER_DIGEST_MODE_INVALID');
    }
    if (!originals.length) {
      await this.prisma.notificationCenterDigestQueueItem.updateMany({
        where: { notificationId: { in: ids } },
        data: {
          status: 'PROCESSED',
          processedAt: input.now,
          processingToken: null,
          processingAt: null,
          lastError: 'SOURCE_NOT_FOUND'
        }
      });
      return {
        created: false as const,
        notificationId: null,
        skippedReason: 'SOURCE_NOT_FOUND' as const
      };
    }

    const idempotencyKey = `center-digest:${input.userId}:${input.bucketKey}`;
    const categoryCounts = originals.reduce<Record<string, number>>(
      (result, notification) => {
        const category = classifyNotificationType(notification.type);
        result[category] = (result[category] ?? 0) + 1;
        return result;
      },
      {}
    );
    const result = await this.prisma.$transaction(
      async (tx) => {
        const existing =
          await tx.notificationCenterDigestBatch.findUnique({
            where: { idempotencyKey }
          });
        if (existing?.notificationId) {
          await tx.notificationCenterDigestQueueItem.updateMany({
            where: { notificationId: { in: ids } },
            data: {
              status: 'PROCESSED',
              processedAt: input.now,
              processingToken: null,
              processingAt: null,
              lastError: null
            }
          });
          return {
            created: false as const,
            notificationId: existing.notificationId
          };
        }

        const label = mode === 'HOURLY' ? 'horaire' : 'quotidien';
        const digest = await tx.notification.create({
          data: {
            userId: input.userId,
            type: 'NOTIFICATION_DIGEST',
            title: `Votre résumé ${label} KnowMe`,
            body:
              originals.length === 1
                ? '1 nouvelle activité vous attend.'
                : `${originals.length} nouvelles activités vous attendent.`,
            data: {
              route: '/notifications',
              entityType: 'NOTIFICATION_DIGEST',
              digestMode: mode,
              bucketKey: input.bucketKey,
              notificationIds: originals.map((item) => item.id),
              categoryCounts
            } as Prisma.InputJsonValue
          }
        });
        await tx.notificationCenterDigestBatch.upsert({
          where: { idempotencyKey },
          create: {
            idempotencyKey,
            userId: input.userId,
            digestMode: mode,
            bucketKey: input.bucketKey,
            notificationId: digest.id,
            itemCount: originals.length
          },
          update: {
            notificationId: digest.id,
            itemCount: originals.length
          }
        });
        await tx.notificationCenterDigestQueueItem.updateMany({
          where: { notificationId: { in: ids } },
          data: {
            status: 'PROCESSED',
            processedAt: input.now,
            processingToken: null,
            processingAt: null,
            lastError: null
          }
        });
        return { created: true as const, notification: digest };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (result.created && 'notification' in result) {
      this.realtime.emitNotificationCreated(input.userId, result.notification);
      return { created: true as const, notificationId: result.notification.id };
    }
    return result;
  }

  private async recoverStale(now: Date) {
    const staleBefore = new Date(now.getTime() - 10 * 60_000);
    await this.prisma.notificationCenterDigestQueueItem.updateMany({
      where: {
        status: 'PROCESSING',
        processingAt: { lt: staleBefore }
      },
      data: {
        status: 'PENDING',
        processingToken: null,
        processingAt: null,
        lastError: 'STALE_PROCESSING_RECOVERED'
      }
    });
  }

  private async retryFailed() {
    await this.prisma.notificationCenterDigestQueueItem.updateMany({
      where: { status: 'FAILED', attempts: { lt: 5 } },
      data: { status: 'PENDING', lastError: null }
    });
  }
}
