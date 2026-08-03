import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileCircleNotificationDeliveryService } from './profile-circle-notification-delivery.service';
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
    private readonly preferences: ProfileCircleNotificationPreferencesService,
    private readonly delivery: ProfileCircleNotificationDeliveryService
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
      return { delivered: 0, deferred: 0, replayed: false, reason: validation.reason };
    }

    const now = new Date();
    const preferenceResolution = await this.preferences.resolve({
      type: input.type,
      circleId: input.circleId,
      recipients: candidates,
      now
    });
    const recipients = preferenceResolution.inboxRecipients;
    if (recipients.length === 0) {
      return {
        delivered: 0,
        deferred: 0,
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
        data: input.data as Prisma.InputJsonValue | undefined
      },
      update: {}
    });

    await Promise.all(
      recipients.map((userId) => {
        const decision = preferenceResolution.decisions.get(userId)!;
        return this.prisma.profileCircleNotificationRecipient.upsert({
          where: {
            dispatchId_userId: { dispatchId: dispatch.id, userId }
          },
          create: {
            dispatchId: dispatch.id,
            userId,
            status:
              decision.deliveryMode === 'INSTANT' ? 'PENDING' : 'DEFERRED',
            deliveryMode: decision.deliveryMode,
            availableAt: decision.availableAt
          },
          update: {}
        });
      })
    );

    let delivered = 0;
    let realtimePublished = 0;
    for (const userId of recipients) {
      const decision = preferenceResolution.decisions.get(userId)!;
      if (decision.deliveryMode !== 'INSTANT') continue;
      const created = await this.delivery.deliverInstant({
        dispatchId: dispatch.id,
        userId,
        publishRealtime: decision.realtimeAllowed
      });
      if (created) {
        delivered += 1;
        if (decision.realtimeAllowed) realtimePublished += 1;
      }
    }

    const statusCounts = await this.prisma.profileCircleNotificationRecipient.groupBy({
      by: ['status'],
      where: { dispatchId: dispatch.id },
      _count: { _all: true }
    });
    const count = (status: string) =>
      statusCounts.find((entry) => entry.status === status)?._count._all ?? 0;

    return {
      dispatchId: dispatch.id,
      candidates: candidates.length,
      recipients: recipients.length,
      suppressed: candidates.length - recipients.length,
      delivered: count('DELIVERED'),
      deferred: count('DEFERRED'),
      failed: count('FAILED'),
      realtimePublished,
      replayed: delivered === 0 && count('DELIVERED') > 0
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
}
