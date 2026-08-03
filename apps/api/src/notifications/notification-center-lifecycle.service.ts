import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationCenterLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  async exportForAccount(userId: string) {
    const [preference, states, actionReceipts, digestQueue, digestBatches] =
      await Promise.all([
        this.prisma.notificationCenterPreference.findUnique({
          where: { userId }
        }),
        this.prisma.notificationCenterUserState.findMany({
          where: { userId },
          orderBy: [{ updatedAt: 'desc' }, { notificationId: 'desc' }]
        }),
        this.prisma.notificationCenterActionReceipt.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' }
        }),
        this.prisma.notificationCenterDigestQueueItem.findMany({
          where: { userId },
          orderBy: [{ createdAt: 'desc' }, { notificationId: 'desc' }]
        }),
        this.prisma.notificationCenterDigestBatch.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' }
        })
      ]);

    return {
      formatVersion: 1,
      preference,
      states,
      actionReceipts,
      digestQueue,
      digestBatches,
      transportSecretsIncluded: false
    } as const;
  }

  async deleteForAccount(userId: string, tx: Prisma.TransactionClient) {
    const [digestQueue, digestBatches, actionReceipts, states, preferences] =
      await Promise.all([
        tx.notificationCenterDigestQueueItem.deleteMany({ where: { userId } }),
        tx.notificationCenterDigestBatch.deleteMany({ where: { userId } }),
        tx.notificationCenterActionReceipt.deleteMany({ where: { userId } }),
        tx.notificationCenterUserState.deleteMany({ where: { userId } }),
        tx.notificationCenterPreference.deleteMany({ where: { userId } })
      ]);

    return {
      digestQueue: digestQueue.count,
      digestBatches: digestBatches.count,
      actionReceipts: actionReceipts.count,
      states: states.count,
      preferences: preferences.count
    };
  }
}
