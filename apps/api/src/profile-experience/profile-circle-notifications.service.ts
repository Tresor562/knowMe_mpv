import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileCircleNotificationPreferencesService } from './profile-circle-notification-preferences.service';
import {
  normalizeNotificationRecipients,
  ProfileCircleNotificationType,
  validateCircleNotification
} from './profile-circle-notifications.domain';

@Injectable()
export class ProfileCircleNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly preferences: ProfileCircleNotificationPreferencesService
  ) {}

  async dispatch(input: {
    idempotencyKey: string;
    type: ProfileCircleNotificationType;
    title: string;
    body: string;
    recipients: string[];
    actorUserId?: string | null;
    circleId?: string | null;
    data?: Record<string, unknown>;
    includeActor?: boolean;
  }) {
    const candidates = normalizeNotificationRecipients({
      recipients: input.recipients,
      actorUserId: input.actorUserId,
      includeActor: input.includeActor
    });
    const validation = validateCircleNotification({
      ...input,
      recipients: candidates
    });
    if (!validation.deliver) {
      return { delivered: 0, replayed: false, reason: validation.reason };
    }

    const preferenceResolution = await this.preferences.resolve({
      type: input.type,
      circleId: input.circleId,
      recipients: candidates
    });
    const recipients = preferenceResolution.inboxRecipients;
    if (recipients.length === 0) {
      return {
        delivered: 0,
        replayed: false,
        reason: 'PREFERENCES_SUPPRESSED',
        candidates: candidates.length,
        suppressed: candidates.length
      };
    }

    const dispatch = await this.prisma.profileCircleNotificationDispatch.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      create: {
        idempotencyKey: input.idempotencyKey,
        type: input.type,
        circleId: input.circleId ?? null,
        actorUserId: input.actorUserId ?? null,
        title: input.title.trim(),
        body: input.body.trim(),
        data: input.data as Prisma.InputJsonValue | undefined,
        recipients: {
          create: recipients.map((userId) => ({ userId }))
        }
      },
      update: {}
    });

    await Promise.all(
      recipients.map((userId) =>
        this.prisma.profileCircleNotificationRecipient.upsert({
          where: {
            dispatchId_userId: { dispatchId: dispatch.id, userId }
          },
          create: { dispatchId: dispatch.id, userId },
          update: {}
        })
      )
    );

    const published: Array<{ userId: string; notification: unknown }> = [];
    let replayed = true;

    for (const userId of recipients) {
      const token = randomUUID();
      try {
        const notification = await this.prisma.$transaction(
          async (tx) => {
            const recipient =
              await tx.profileCircleNotificationRecipient.findUnique({
                where: {
                  dispatchId_userId: { dispatchId: dispatch.id, userId }
                }
              });
            if (!recipient || recipient.status === 'DELIVERED') return null;

            const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
            const claim = await tx.profileCircleNotificationRecipient.updateMany({
              where: {
                id: recipient.id,
                status: { in: ['PENDING', 'FAILED', 'PROCESSING'] },
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
                userId,
                type: dispatch.type,
                title: dispatch.title,
                body: dispatch.body,
                data: {
                  ...this.jsonRecord(dispatch.data),
                  collectiveNotification: true,
                  dispatchKey: dispatch.idempotencyKey,
                  circleId: dispatch.circleId,
                  actorUserId: dispatch.actorUserId
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
        if (notification) {
          replayed = false;
          if (preferenceResolution.realtimeRecipients.has(userId)) {
            published.push({ userId, notification });
          }
        }
      } catch (error) {
        await this.prisma.profileCircleNotificationRecipient.updateMany({
          where: {
            dispatchId: dispatch.id,
            userId,
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
      }
    }

    for (const entry of published) {
      this.notifications.publishCreated(
        entry.notification as { userId: string }
      );
    }

    return {
      dispatchId: dispatch.id,
      candidates: candidates.length,
      recipients: recipients.length,
      suppressed: candidates.length - recipients.length,
      delivered: await this.prisma.profileCircleNotificationRecipient.count({
        where: { dispatchId: dispatch.id, status: 'DELIVERED' }
      }),
      realtimePublished: published.length,
      replayed
    };
  }

  async actorLabel(userId: string | null | undefined) {
    if (!userId) return 'Un membre';
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, username: true }
    });
    return user?.displayName || (user?.username ? `@${user.username}` : 'Un membre');
  }

  circleSummary(circleId: string) {
    return this.prisma.profileCircle.findUnique({
      where: { id: circleId },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        status: true,
        ownerUserId: true
      }
    });
  }

  async activeMembers(circleId: string) {
    const memberships = await this.prisma.profileCircleMember.findMany({
      where: { circleId, status: 'ACTIVE' },
      select: { userId: true }
    });
    return memberships.map((entry) => entry.userId);
  }

  async activeManagers(circleId: string) {
    const circle = await this.prisma.profileCircle.findUnique({
      where: { id: circleId },
      select: { ownerUserId: true }
    });
    if (!circle) return [];
    const memberships = await this.prisma.profileCircleMember.findMany({
      where: {
        circleId,
        status: 'ACTIVE',
        role: { in: ['ADMIN', 'OFFICER'] }
      },
      select: { userId: true }
    });
    return [circle.ownerUserId, ...memberships.map((entry) => entry.userId)];
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
