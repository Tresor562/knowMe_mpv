import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ResolvePaymentFraudDto } from './dto/payments.dto';

@Injectable()
export class PaymentAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async summary(periodValue = 'MONTH') {
    const period = periodValue.trim().toUpperCase();
    const since = this.periodStart(period);
    const paidStatuses = ['PAID', 'FULFILLED'];
    const [totals, byProvider, byCurrency, byCountry, statusCounts, activeSubscriptions] =
      await Promise.all([
        this.prisma.paymentOrder.groupBy({
          by: ['currency'],
          where: {
            status: { in: paidStatuses },
            createdAt: { gte: since }
          },
          _sum: { expectedAmount: true },
          _count: { _all: true }
        }),
        this.prisma.paymentOrder.groupBy({
          by: ['provider', 'currency'],
          where: {
            status: { in: paidStatuses },
            createdAt: { gte: since }
          },
          _sum: { expectedAmount: true },
          _count: { _all: true }
        }),
        this.prisma.paymentOrder.groupBy({
          by: ['currency'],
          where: { createdAt: { gte: since } },
          _sum: { expectedAmount: true },
          _count: { _all: true }
        }),
        this.prisma.paymentOrder.groupBy({
          by: ['countryCode', 'currency'],
          where: {
            status: { in: paidStatuses },
            createdAt: { gte: since }
          },
          _sum: { expectedAmount: true },
          _count: { _all: true }
        }),
        this.prisma.paymentOrder.groupBy({
          by: ['status'],
          where: { createdAt: { gte: since } },
          _count: { _all: true }
        }),
        this.prisma.billingSubscription.count({
          where: {
            status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] },
            currentPeriodEnd: { gt: new Date() }
          }
        })
      ]);

    return {
      period,
      since,
      generatedAt: new Date(),
      revenue: totals.map((entry) => ({
        currency: entry.currency,
        amount: entry._sum.expectedAmount ?? 0,
        orders: entry._count._all
      })),
      byProvider: byProvider.map((entry) => ({
        provider: entry.provider,
        currency: entry.currency,
        amount: entry._sum.expectedAmount ?? 0,
        orders: entry._count._all
      })),
      byCurrency: byCurrency.map((entry) => ({
        currency: entry.currency,
        grossOrderValue: entry._sum.expectedAmount ?? 0,
        orders: entry._count._all
      })),
      byCountry: byCountry.map((entry) => ({
        countryCode: entry.countryCode ?? 'UNKNOWN',
        currency: entry.currency,
        amount: entry._sum.expectedAmount ?? 0,
        orders: entry._count._all
      })),
      statuses: statusCounts.map((entry) => ({
        status: entry.status,
        count: entry._count._all
      })),
      activeSubscriptions
    };
  }

  orders(input: {
    status?: string;
    provider?: string;
    userId?: string;
    productKey?: string;
  }) {
    return this.prisma.paymentOrder.findMany({
      where: {
        ...(input.status ? { status: input.status.trim().toUpperCase() } : {}),
        ...(input.provider
          ? { provider: input.provider.trim().toUpperCase() }
          : {}),
        ...(input.userId ? { userId: input.userId.trim() } : {}),
        ...(input.productKey
          ? { product: { key: input.productKey.trim().toLowerCase() } }
          : {})
      },
      include: {
        product: true,
        price: true,
        invoice: true,
        attempts: { orderBy: { createdAt: 'desc' }, take: 5 },
        refunds: { orderBy: { createdAt: 'desc' }, take: 5 }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
  }

  webhookLogs(provider?: string, status?: string) {
    return this.prisma.paymentWebhookLog.findMany({
      where: {
        ...(provider ? { provider: provider.trim().toUpperCase() } : {}),
        ...(status ? { status: status.trim().toUpperCase() } : {})
      },
      orderBy: { receivedAt: 'desc' },
      take: 200
    });
  }

  fraudLogs(status?: string, severity?: string) {
    return this.prisma.paymentFraudLog.findMany({
      where: {
        ...(status ? { status: status.trim().toUpperCase() } : {}),
        ...(severity ? { severity: severity.trim().toUpperCase() } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
  }

  async resolveFraud(
    actorId: string,
    fraudId: string,
    dto: ResolvePaymentFraudDto
  ) {
    const current = await this.prisma.paymentFraudLog.findUnique({
      where: { id: fraudId }
    });
    if (!current) throw new NotFoundException('Signal de fraude introuvable.');
    const updated = await this.prisma.paymentFraudLog.update({
      where: { id: fraudId },
      data: {
        status: dto.status,
        resolvedAt: new Date(),
        resolvedById: actorId,
        details: {
          ...(current.details as Record<string, unknown> | null),
          resolutionReason: dto.reason.trim()
        }
      }
    });
    await this.audit.record({
      actorId,
      action: 'PAYMENT_FRAUD_RESOLVE',
      entity: 'PaymentFraudLog',
      entityId: fraudId,
      targetAccountId: current.userId,
      metadata: {
        previousStatus: current.status,
        nextStatus: dto.status,
        reason: dto.reason.trim(),
        orderId: current.orderId,
        type: current.type,
        severity: current.severity
      }
    });
    return updated;
  }

  products() {
    return this.prisma.commerceProduct.findMany({
      include: { prices: { orderBy: [{ platform: 'asc' }, { currency: 'asc' }] } },
      orderBy: [{ active: 'desc' }, { highlighted: 'desc' }, { createdAt: 'asc' }]
    });
  }

  private periodStart(period: string) {
    const now = new Date();
    if (period === 'DAY') {
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    }
    if (period === 'YEAR') {
      return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    }
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
}
