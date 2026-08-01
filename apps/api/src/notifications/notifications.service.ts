import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

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

    this.realtime.emitNotificationCreated(input.userId, notification);
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
}
