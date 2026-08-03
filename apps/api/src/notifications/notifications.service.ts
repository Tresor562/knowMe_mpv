import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import {
  classifyNotificationType,
  notificationDigestSchedule
} from './notification-center.domain';
import { NotificationCenterDigestService } from './notification-center-digest.service';
import { NotificationCenterPolicyService } from './notification-center-policy.service';

export type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly policy: NotificationCenterPolicyService,
    private readonly digests: NotificationCenterDigestService
  ) {}

  list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification
      .count({ where: { userId, readAt: null } })
      .then((count) => ({ count }));
  }

  async create(input: CreateNotificationInput) {
    const now = new Date();
    const delivery = await this.policy.deliveryFor({
      userId: input.userId,
      type: input.type,
      data: input.data,
      now
    });
    const notification = await this.prisma.$transaction(async (tx) => {
      const created = await tx.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body,
          ...(input.data ? { data: input.data } : {})
        }
      });
      if (
        delivery.decision.digest &&
        (delivery.decision.digestMode === 'HOURLY' ||
          delivery.decision.digestMode === 'DAILY')
      ) {
        const schedule = notificationDigestSchedule({
          mode: delivery.decision.digestMode,
          now,
          timezone: delivery.preference.timezone,
          dailyDigestMinute: delivery.preference.dailyDigestMinute
        });
        await tx.notificationCenterDigestQueueItem.create({
          data: {
            notificationId: created.id,
            userId: created.userId,
            category: classifyNotificationType(created.type),
            digestMode: delivery.decision.digestMode,
            bucketKey: schedule.bucketKey,
            dueAt: schedule.dueAt
          }
        });
      }
      return created;
    });

    if (delivery.decision.realtime) {
      this.realtime.emitNotificationCreated(notification.userId, notification);
    }
    return {
      ...notification,
      deliveryPolicy: delivery.decision
    };
  }

  publishCreated<T extends {
    id: string;
    userId: string;
    type: string;
    data?: Prisma.JsonValue | null;
  }>(notification: T) {
    void this.publishStored(notification).catch((error) => {
      const code =
        error instanceof Error ? error.message.slice(0, 180) : 'UNKNOWN_ERROR';
      this.logger.error(
        `Stored notification ${notification.id} publication failed: ${code}`
      );
    });
    return notification;
  }

  async createMany(inputs: CreateNotificationInput[]) {
    return Promise.all(inputs.map((input) => this.create(input)));
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId }
    });
    if (!notification) {
      throw new NotFoundException('Notification introuvable.');
    }
    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: notification.readAt ?? new Date() }
    });
    if (updated.readAt) {
      this.realtime.emitNotificationRead(userId, updated.id, updated.readAt);
    }
    return updated;
  }

  async markAllRead(userId: string) {
    const readAt = new Date();
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt }
    });
    this.realtime.emitNotificationsReadAll(userId, readAt);
    return { ...result, readAt };
  }

  private async publishStored(notification: {
    id: string;
    userId: string;
    type: string;
    data?: Prisma.JsonValue | null;
  }) {
    const now = new Date();
    const delivery = await this.policy.deliveryFor({
      userId: notification.userId,
      type: notification.type,
      data: notification.data,
      now
    });
    if (
      delivery.decision.digest &&
      (delivery.decision.digestMode === 'HOURLY' ||
        delivery.decision.digestMode === 'DAILY')
    ) {
      await this.digests.enqueue({
        notificationId: notification.id,
        userId: notification.userId,
        type: notification.type,
        mode: delivery.decision.digestMode,
        preference: delivery.preference,
        now
      });
    }
    if (delivery.decision.realtime) {
      this.realtime.emitNotificationCreated(notification.userId, notification);
    }
    return delivery.decision;
  }
}
