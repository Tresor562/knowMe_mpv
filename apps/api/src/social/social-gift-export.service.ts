import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const GIFT_NOTIFICATION_TYPE = 'SOCIAL_GIFT';
const GIFT_LEDGER_TYPE = 'SOCIAL_GIFT_SENT';
const GIFT_LEDGER_SOURCE = 'SOCIAL_GIFT';

@Injectable()
export class SocialGiftExportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportForAccount(userId: string) {
    const [received, sent] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId, type: GIFT_NOTIFICATION_TYPE },
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          data: true,
          createdAt: true,
          readAt: true
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
      }),
      this.prisma.knowCoinLedgerEntry.findMany({
        where: {
          userId,
          type: GIFT_LEDGER_TYPE,
          source: GIFT_LEDGER_SOURCE
        },
        select: {
          id: true,
          amount: true,
          balanceBefore: true,
          balanceAfter: true,
          type: true,
          source: true,
          idempotencyKey: true,
          referenceType: true,
          referenceId: true,
          reason: true,
          metadata: true,
          createdAt: true
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
      })
    ]);

    return {
      schemaVersion: 1,
      received: received.map((notification) => ({
        ...notification,
        data: this.safeJson(notification.data)
      })),
      sent: sent.map((entry) => ({
        ...entry,
        metadata: this.safeJson(entry.metadata),
        recipientBalanceCredited: false,
        visualOnly: true,
        redeemable: false,
        transferable: false
      }))
    } as const;
  }

  private safeJson(value: Prisma.JsonValue | null) {
    return value ?? null;
  }
}
