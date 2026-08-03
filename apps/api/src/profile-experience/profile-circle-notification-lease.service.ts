import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  createLeaseToken,
  leaseIsExpired,
  nextLeaseExpiry
} from './profile-circle-notification-lease.domain';

export type AcquiredNotificationLease = {
  key: string;
  ownerId: string;
  leaseToken: string;
  expiresAt: Date;
};

@Injectable()
export class ProfileCircleNotificationLeaseService {
  constructor(private readonly prisma: PrismaService) {}

  async acquire(input: {
    key: string;
    ownerId: string;
    ttlMs: number;
    now?: Date;
  }): Promise<AcquiredNotificationLease | null> {
    const now = input.now ?? new Date();
    const leaseToken = createLeaseToken(input.ownerId);
    const expiresAt = nextLeaseExpiry(now, input.ttlMs);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const existing =
            await tx.profileCircleNotificationSchedulerLease.findUnique({
              where: { key: input.key }
            });

          if (!existing) {
            return tx.profileCircleNotificationSchedulerLease.create({
              data: {
                key: input.key,
                ownerId: input.ownerId,
                leaseToken,
                acquiredAt: now,
                heartbeatAt: now,
                expiresAt
              },
              select: { key: true, ownerId: true, leaseToken: true, expiresAt: true }
            });
          }

          if (!leaseIsExpired(existing, now) && existing.ownerId !== input.ownerId) {
            return null;
          }

          return tx.profileCircleNotificationSchedulerLease.update({
            where: { key: input.key },
            data: {
              ownerId: input.ownerId,
              leaseToken,
              acquiredAt: now,
              heartbeatAt: now,
              expiresAt
            },
            select: { key: true, ownerId: true, leaseToken: true, expiresAt: true }
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      ) {
        return null;
      }
      throw error;
    }
  }

  async heartbeat(input: {
    key: string;
    ownerId: string;
    leaseToken: string;
    ttlMs: number;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const updated =
      await this.prisma.profileCircleNotificationSchedulerLease.updateMany({
        where: {
          key: input.key,
          ownerId: input.ownerId,
          leaseToken: input.leaseToken,
          expiresAt: { gt: now }
        },
        data: {
          heartbeatAt: now,
          expiresAt: nextLeaseExpiry(now, input.ttlMs)
        }
      });
    return updated.count === 1;
  }

  async release(input: {
    key: string;
    ownerId: string;
    leaseToken: string;
  }) {
    const released =
      await this.prisma.profileCircleNotificationSchedulerLease.deleteMany({
        where: {
          key: input.key,
          ownerId: input.ownerId,
          leaseToken: input.leaseToken
        }
      });
    return released.count === 1;
  }

  async status(key: string) {
    const lease =
      await this.prisma.profileCircleNotificationSchedulerLease.findUnique({
        where: { key }
      });
    if (!lease) return { active: false, lease: null };
    return {
      active: !leaseIsExpired(lease),
      lease: {
        key: lease.key,
        ownerId: lease.ownerId,
        acquiredAt: lease.acquiredAt,
        heartbeatAt: lease.heartbeatAt,
        expiresAt: lease.expiresAt
      }
    };
  }
}
