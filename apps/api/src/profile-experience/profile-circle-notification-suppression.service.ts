import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileCircleTransportChannel } from './profile-circle-notification-endpoints.service';

export type ProfileCircleSuppressionReason =
  | 'USER_OPT_OUT'
  | 'HARD_BOUNCE'
  | 'COMPLAINT'
  | 'INVALID_ENDPOINT'
  | 'ADMINISTRATIVE';

@Injectable()
export class ProfileCircleNotificationSuppressionService {
  constructor(private readonly prisma: PrismaService) {}

  suppress(input: {
    userId: string;
    channel: ProfileCircleTransportChannel;
    reason: ProfileCircleSuppressionReason;
    addressHash?: string;
    expiresAt?: Date;
    note?: string;
    createdBy?: string;
  }) {
    return this.prisma.profileCircleNotificationSuppression.create({
      data: {
        userId: input.userId,
        channel: input.channel,
        reason: input.reason,
        addressHash: input.addressHash ?? null,
        expiresAt: input.expiresAt ?? null,
        note: input.note?.slice(0, 300) ?? null,
        createdBy: input.createdBy ?? null
      },
      select: {
        id: true,
        channel: true,
        reason: true,
        active: true,
        expiresAt: true,
        createdAt: true
      }
    });
  }

  async isSuppressed(input: {
    userId: string;
    channel: ProfileCircleTransportChannel;
    addressHash?: string;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const suppression =
      await this.prisma.profileCircleNotificationSuppression.findFirst({
        where: {
          userId: input.userId,
          channel: input.channel,
          active: true,
          AND: [
            {
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
            },
            input.addressHash
              ? {
                  OR: [
                    { addressHash: null },
                    { addressHash: input.addressHash }
                  ]
                }
              : { addressHash: null }
          ]
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
      });
    return suppression
      ? { suppressed: true as const, reason: suppression.reason, id: suppression.id }
      : { suppressed: false as const, reason: null, id: null };
  }

  async release(input: { id: string; userId?: string }) {
    const result =
      await this.prisma.profileCircleNotificationSuppression.updateMany({
        where: {
          id: input.id,
          active: true,
          ...(input.userId ? { userId: input.userId } : {})
        },
        data: { active: false }
      });
    return result.count === 1;
  }

  async releaseUserOptOuts(
    userId: string,
    channel: ProfileCircleTransportChannel
  ) {
    const result =
      await this.prisma.profileCircleNotificationSuppression.updateMany({
        where: {
          userId,
          channel,
          reason: 'USER_OPT_OUT',
          active: true
        },
        data: { active: false }
      });
    return result.count;
  }

  async expire(now = new Date()) {
    const result =
      await this.prisma.profileCircleNotificationSuppression.updateMany({
        where: { active: true, expiresAt: { lte: now } },
        data: { active: false }
      });
    return result.count;
  }
}
