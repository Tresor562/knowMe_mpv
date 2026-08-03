import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileCircleNotificationPreferencesService } from './profile-circle-notification-preferences.service';
import {
  isMinuteInQuietWindow,
  localMinuteOfDay
} from './profile-circle-notification-schedule.domain';
import { ProfileCircleNotificationType } from './profile-circle-notifications.domain';

@Injectable()
export class ProfileCircleNotificationDeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly preferences: ProfileCircleNotificationPreferencesService
  ) {}

  async deliverInstant(input: {
    dispatchId: string;
    userId: string;
    publishRealtime: boolean;
  }) {
    const delivered = await this.deliverSingle({
      dispatchId: input.dispatchId,
      userId: input.userId,
      allowedStatuses: ['PENDING', 'FAILED'],
      publishRealtime: input.publishRealtime
    });
    return Boolean(delivered);
  }

  async flushDue(input: {
    userId?: string;
    limit?: number;
    now?: Date;
  } = {}) {
    const now = input.now ?? new Date();
    const limit = Math.min(1_000, Math.max(1, input.limit ?? 300));
    const due = await this.prisma.profileCircleNotificationRecipient.findMany({
      where: {
        ...(input.userId ? { userId: input.userId } : {}),
        status: { in: ['DEFERRED', 'FAILED'] },
        availableAt: { lte: now },
        OR: [
          { processingAt: null },
          { processingAt: { lte: new Date(now.getTime() - 5 * 60 * 1000) } }
        ]
      },
      include: { dispatch: true },
      orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      take: limit
    });

    const digestByUser = new Map<string, typeof due>();
    const individual = [] as typeof due;
    for (const recipient of due) {
      if (recipient.deliveryMode === 'DAILY_DIGEST') {
        const entries = digestByUser.get(recipient.userId) ?? [];
        entries.push(recipient);
        digestByUser.set(recipient.userId, entries);
      } else {
        individual.push(recipient);
      }
    }

    let delivered = 0;
    let suppressed = 0;
    let rescheduled = 0;
    let failed = 0;
    let realtimePublished = 0;
    let digests = 0;

    for (const recipient of individual) {
      try {
        const decision = await this.currentDecision(recipient, now);
        if (!decision.inboxAllowed) {
          await this.suppressRecipient(recipient.id, 'PREFERENCE_SUPPRESSED');
          suppressed += 1;
          continue;
        }
        if (decision.deliveryMode !== 'INSTANT') {
          await this.rescheduleRecipient(
            recipient.id,
            decision.deliveryMode,
            decision.availableAt
          );
          rescheduled += 1;
          continue;
        }
        const created = await this.deliverSingle({
          dispatchId: recipient.dispatchId,
          userId: recipient.userId,
          allowedStatuses: ['DEFERRED', 'FAILED'],
          publishRealtime: decision.realtimeAllowed
        });
        if (created) {
          delivered += 1;
          if (decision.realtimeAllowed) realtimePublished += 1;
        }
      } catch {
        failed += 1;
      }
    }

    for (const [userId, recipients] of digestByUser) {
      try {
        const result = await this.deliverDigest(userId, recipients, now);
        delivered += result.deliveredItems;
        suppressed += result.suppressedItems;
        rescheduled += result.rescheduledItems;
        realtimePublished += result.realtimePublished ? 1 : 0;
        digests += result.digestCreated ? 1 : 0;
      } catch {
        failed += recipients.length;
      }
    }

    return {
      scanned: due.length,
      delivered,
      suppressed,
      rescheduled,
      failed,
      digests,
      realtimePublished,
      serverTime: now
    };
  }

  async health() {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - 5 * 60 * 1000);
    const [pending, deferredDue, failed, staleProcessing, delivered24h, suppressed24h] =
      await Promise.all([
        this.prisma.profileCircleNotificationRecipient.count({
          where: { status: 'PENDING' }
        }),
        this.prisma.profileCircleNotificationRecipient.count({
          where: { status: 'DEFERRED', availableAt: { lte: now } }
        }),
        this.prisma.profileCircleNotificationRecipient.count({
          where: { status: 'FAILED' }
        }),
        this.prisma.profileCircleNotificationRecipient.count({
          where: { status: 'PROCESSING', processingAt: { lte: staleBefore } }
        }),
        this.prisma.profileCircleNotificationRecipient.count({
          where: {
            status: 'DELIVERED',
            deliveredAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
          }
        }),
        this.prisma.profileCircleNotificationRecipient.count({
          where: {
            status: 'SUPPRESSED',
            suppressedAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
          }
        })
      ]);
    return {
      pending,
      deferredDue,
      failed,
      staleProcessing,
      delivered24h,
      suppressed24h,
      healthy: staleProcessing === 0 && failed < 100,
      serverTime: now
    };
  }

  async retryFailed(input: { limit?: number; userId?: string } = {}) {
    const now = new Date();
    const failed = await this.prisma.profileCircleNotificationRecipient.findMany({
      where: {
        status: 'FAILED',
        ...(input.userId ? { userId: input.userId } : {})
      },
      orderBy: [{ failedAt: 'asc' }, { id: 'asc' }],
      take: Math.min(1_000, Math.max(1, input.limit ?? 300)),
      select: { id: true, deliveryMode: true, availableAt: true }
    });
    await this.prisma.$transaction(
      failed.map((recipient) =>
        this.prisma.profileCircleNotificationRecipient.update({
          where: { id: recipient.id },
          data: {
            status:
              recipient.deliveryMode === 'INSTANT' && recipient.availableAt <= now
                ? 'PENDING'
                : 'DEFERRED',
            processingToken: null,
            processingAt: null,
            failedAt: null,
            errorCode: null
          }
        })
      )
    );
    const instant = failed.filter(
      (recipient) =>
        recipient.deliveryMode === 'INSTANT' && recipient.availableAt <= now
    ).length;
    return {
      reset: failed.length,
      instant,
      deferred: failed.length - instant,
      serverTime: now
    };
  }

  private async deliverDigest(
    userId: string,
    candidates: Array<{
      id: string;
      dispatchId: string;
      userId: string;
      status: string;
      deliveryMode: string;
      availableAt: Date;
      dispatch: {
        id: string;
        type: string;
        title: string;
        body: string;
        circleId: string | null;
        actorUserId: string | null;
        data: Prisma.JsonValue | null;
        idempotencyKey: string;
      };
    }>,
    now: Date
  ) {
    const deliverable = [] as typeof candidates;
    let suppressedItems = 0;
    let rescheduledItems = 0;

    for (const candidate of candidates) {
      const decision = await this.currentDecision(candidate, now);
      if (!decision.inboxAllowed) {
        await this.suppressRecipient(candidate.id, 'PREFERENCE_SUPPRESSED');
        suppressedItems += 1;
        continue;
      }
      if (decision.deliveryMode === 'DAILY_DIGEST') {
        deliverable.push(candidate);
        continue;
      }
      if (decision.deliveryMode === 'AFTER_QUIET_HOURS') {
        await this.rescheduleRecipient(
          candidate.id,
          decision.deliveryMode,
          decision.availableAt
        );
        rescheduledItems += 1;
        continue;
      }
      deliverable.push(candidate);
    }

    if (deliverable.length === 0) {
      return {
        deliveredItems: 0,
        suppressedItems,
        rescheduledItems,
        digestCreated: false,
        realtimePublished: false
      };
    }

    const token = randomUUID();
    const ids = deliverable.map((entry) => entry.id);
    const notification = await this.prisma.$transaction(
      async (tx) => {
        const claim = await tx.profileCircleNotificationRecipient.updateMany({
          where: {
            id: { in: ids },
            userId,
            status: { in: ['DEFERRED', 'FAILED'] },
            availableAt: { lte: now }
          },
          data: {
            status: 'PROCESSING',
            processingToken: token,
            processingAt: now,
            attempts: { increment: 1 },
            failedAt: null,
            errorCode: null
          }
        });
        if (claim.count === 0) return null;

        const claimed = await tx.profileCircleNotificationRecipient.findMany({
          where: {
            id: { in: ids },
            status: 'PROCESSING',
            processingToken: token
          },
          include: { dispatch: true },
          orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }]
        });
        if (claimed.length === 0) return null;

        const categories = new Map<string, number>();
        for (const entry of claimed) {
          categories.set(
            entry.dispatch.type,
            (categories.get(entry.dispatch.type) ?? 0) + 1
          );
        }
        const created = await tx.notification.create({
          data: {
            userId,
            type: 'CIRCLE_DAILY_DIGEST',
            title: 'Résumé de tes profils collectifs',
            body: `${claimed.length} nouvelle${claimed.length > 1 ? 's' : ''} activité${claimed.length > 1 ? 's' : ''} depuis ton dernier résumé.`,
            data: {
              collectiveNotification: true,
              digest: true,
              itemCount: claimed.length,
              categories: Object.fromEntries(categories),
              items: claimed.slice(0, 20).map((entry) => ({
                title: entry.dispatch.title,
                body: entry.dispatch.body,
                type: entry.dispatch.type,
                circleId: entry.dispatch.circleId,
                link: this.jsonRecord(entry.dispatch.data).link ?? '/profile-circles'
              })),
              link: '/notifications'
            } as Prisma.InputJsonValue
          }
        });
        await tx.profileCircleNotificationRecipient.updateMany({
          where: {
            id: { in: claimed.map((entry) => entry.id) },
            status: 'PROCESSING',
            processingToken: token
          },
          data: {
            status: 'DELIVERED',
            notificationId: created.id,
            deliveredAt: now,
            processingToken: null,
            processingAt: null
          }
        });
        return { created, itemCount: claimed.length };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (!notification) {
      return {
        deliveredItems: 0,
        suppressedItems,
        rescheduledItems,
        digestCreated: false,
        realtimePublished: false
      };
    }

    const preference = await this.preferences.get(userId);
    const quiet =
      preference.quietHoursEnabled &&
      isMinuteInQuietWindow(
        localMinuteOfDay(now, preference.timezone),
        preference.quietStartMinute,
        preference.quietEndMinute
      );
    const realtimePublished = preference.realtimeEnabled && !quiet;
    if (realtimePublished) {
      this.notifications.publishCreated(notification.created);
    }
    return {
      deliveredItems: notification.itemCount,
      suppressedItems,
      rescheduledItems,
      digestCreated: true,
      realtimePublished
    };
  }

  private async deliverSingle(input: {
    dispatchId: string;
    userId: string;
    allowedStatuses: Array<'PENDING' | 'DEFERRED' | 'FAILED'>;
    publishRealtime: boolean;
  }) {
    const token = randomUUID();
    try {
      const notification = await this.prisma.$transaction(
        async (tx) => {
          const recipient =
            await tx.profileCircleNotificationRecipient.findUnique({
              where: {
                dispatchId_userId: {
                  dispatchId: input.dispatchId,
                  userId: input.userId
                }
              },
              include: { dispatch: true }
            });
          if (!recipient || recipient.status === 'DELIVERED') return null;

          const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
          const claim = await tx.profileCircleNotificationRecipient.updateMany({
            where: {
              id: recipient.id,
              status: { in: input.allowedStatuses },
              availableAt: { lte: new Date() },
              OR: [
                { processingAt: null },
                { processingAt: { lte: staleBefore } }
              ]
            },
            data: {
              status: 'PROCESSING',
              processingToken: token,
              processingAt: new Date(),
              attempts: { increment: 1 },
              failedAt: null,
              errorCode: null
            }
          });
          if (claim.count !== 1) return null;

          const created = await tx.notification.create({
            data: {
              userId: input.userId,
              type: recipient.dispatch.type,
              title: recipient.dispatch.title,
              body: recipient.dispatch.body,
              data: {
                ...this.jsonRecord(recipient.dispatch.data),
                collectiveNotification: true,
                dispatchKey: recipient.dispatch.idempotencyKey,
                circleId: recipient.dispatch.circleId,
                actorUserId: recipient.dispatch.actorUserId
              } as Prisma.InputJsonValue
            }
          });
          const delivered =
            await tx.profileCircleNotificationRecipient.updateMany({
              where: {
                id: recipient.id,
                status: 'PROCESSING',
                processingToken: token
              },
              data: {
                status: 'DELIVERED',
                notificationId: created.id,
                deliveredAt: new Date(),
                processingToken: null,
                processingAt: null
              }
            });
          if (delivered.count !== 1) {
            throw new Error('NOTIFICATION_DELIVERY_CLAIM_LOST');
          }
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
      if (notification && input.publishRealtime) {
        this.notifications.publishCreated(notification);
      }
      return notification;
    } catch (error) {
      await this.prisma.profileCircleNotificationRecipient.updateMany({
        where: {
          dispatchId: input.dispatchId,
          userId: input.userId,
          status: 'PROCESSING',
          processingToken: token
        },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          errorCode: this.errorCode(error),
          processingToken: null,
          processingAt: null
        }
      });
      throw error;
    }
  }

  private async currentDecision(
    recipient: {
      userId: string;
      dispatch: { type: string; circleId: string | null };
    },
    now: Date
  ) {
    const resolution = await this.preferences.resolve({
      type: recipient.dispatch.type as ProfileCircleNotificationType,
      circleId: recipient.dispatch.circleId,
      recipients: [recipient.userId],
      now
    });
    return resolution.decisions.get(recipient.userId)!;
  }

  private suppressRecipient(recipientId: string, reason: string) {
    return this.prisma.profileCircleNotificationRecipient.update({
      where: { id: recipientId },
      data: {
        status: 'SUPPRESSED',
        suppressedAt: new Date(),
        errorCode: reason,
        processingToken: null,
        processingAt: null
      }
    });
  }

  private rescheduleRecipient(
    recipientId: string,
    deliveryMode: 'INSTANT' | 'AFTER_QUIET_HOURS' | 'DAILY_DIGEST',
    availableAt: Date
  ) {
    return this.prisma.profileCircleNotificationRecipient.update({
      where: { id: recipientId },
      data: {
        status: deliveryMode === 'INSTANT' ? 'PENDING' : 'DEFERRED',
        deliveryMode,
        availableAt,
        processingToken: null,
        processingAt: null,
        failedAt: null,
        errorCode: null
      }
    });
  }

  private jsonRecord(value: Prisma.JsonValue | null | undefined) {
    if (!value || Array.isArray(value) || typeof value !== 'object') return {};
    return value as Record<string, Prisma.JsonValue>;
  }

  private errorCode(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return `PRISMA_${error.code}`;
    }
    return error instanceof Error
      ? error.message.replace(/[^A-Za-z0-9:_-]/g, '_').slice(0, 120)
      : 'UNKNOWN_DELIVERY_ERROR';
  }
}
