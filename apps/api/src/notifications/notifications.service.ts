import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import {
  defaultNotificationPreference,
  normalizeCategorySettings,
  normalizeStringList,
  resolveNotificationDelivery
} from './notification-center.domain';

export type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway
  ) {}

  list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, readAt: null }
    }).then((count) => ({ count }));
  }

  async create(input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        ...(input.data ? { data: input.data } : {})
      }
    });

    return this.publishCreated(notification);
  }

  async publishCreated<T extends {
    userId: string;
    type?: string;
    data?: unknown;
  }>(notification: T): Promise<T> {
    const stored = await this.prisma.notificationPreference.findUnique({
      where: { userId: notification.userId }
    });
    const defaults = defaultNotificationPreference();
    const preference = stored
      ? {
          masterEnabled: stored.masterEnabled,
          realtimeEnabled: stored.realtimeEnabled,
          pushEnabled: stored.pushEnabled,
          digestMode: stored.digestMode,
          quietHoursEnabled: stored.quietHoursEnabled,
          quietStartMinute: stored.quietStartMinute,
          quietEndMinute: stored.quietEndMinute,
          timezone: stored.timezone,
          categorySettings: normalizeCategorySettings(stored.categorySettings),
          mutedTypes: normalizeStringList(stored.mutedTypes),
          mutedCircleIds: normalizeStringList(stored.mutedCircleIds)
        }
      : defaults;
    const data = this.jsonRecord(notification.data);
    const circleId = typeof data.circleId === 'string' ? data.circleId : null;
    const delivery = resolveNotificationDelivery({
      type: notification.type ?? 'SYSTEM_NOTIFICATION',
      circleId,
      minuteOfDay: this.minuteOfDay(preference.timezone),
      preference
    });
    if (delivery.realtime) {
      this.realtime.emitNotificationCreated(notification.userId, notification);
    }
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

  private minuteOfDay(timezone: string) {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }).formatToParts(new Date());
      const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
      const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
      return hour * 60 + minute;
    } catch {
      const now = new Date();
      return now.getUTCHours() * 60 + now.getUTCMinutes();
    }
  }

  private jsonRecord(value: unknown) {
    if (!value || Array.isArray(value) || typeof value !== 'object') return {};
    return value as Record<string, unknown>;
  }
}
