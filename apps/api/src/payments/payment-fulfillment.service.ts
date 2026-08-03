import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import {
  VerifiedProviderPayment,
  VerifiedStorePurchase
} from './payment-provider.types';

const ACCESS_STATUSES = new Set(['TRIALING', 'ACTIVE', 'PAST_DUE']);

type Verification = VerifiedProviderPayment | VerifiedStorePurchase;

@Injectable()
export class PaymentFulfillmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly audit: AuditService
  ) {}

  async fulfill(orderId: string, verification: Verification) {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { id: orderId },
      include: { product: true, price: true, invoice: true }
    });
    if (!order) throw new NotFoundException('Commande de paiement introuvable.');
    if (order.fulfilledAt) return { order, replayed: true };

    const eligible = await this.isEligible(order.userId, order.product.requiresVerification);
    if (!eligible) {
      const review = await this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: {
          status: 'REVIEW_REQUIRED',
          failureCode: 'IDENTITY_VERIFICATION_REQUIRED'
        }
      });
      return { order: review, replayed: false, reviewRequired: true };
    }

    if (order.product.fulfillmentType === 'KNOWCOINS') {
      return this.fulfillKnowCoins(order.id);
    }
    if (order.product.fulfillmentType === 'ENTITLEMENT') {
      return this.fulfillEntitlement(order.id);
    }
    if (order.product.fulfillmentType === 'BILLING_PLAN') {
      return this.fulfillSubscription(order.id, verification);
    }
    throw new BadRequestException('Type d’attribution commerciale inconnu.');
  }

  private async fulfillKnowCoins(orderId: string) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const order = await tx.paymentOrder.findUniqueOrThrow({
          where: { id: orderId },
          include: { product: true }
        });
        if (order.fulfilledAt) return { order, replayed: true };
        const ledger = await this.wallet.applyInTransaction(tx, {
          userId: order.userId,
          amount: order.product.fulfillmentQuantity,
          type: 'PURCHASE_CREDIT',
          source: 'PAYMENT',
          idempotencyKey: `payment:${order.id}:knowcoins`,
          referenceType: 'PaymentOrder',
          referenceId: order.id,
          reason: `Achat vérifié ${order.product.key}.`,
          metadata: {
            provider: order.provider,
            productKey: order.product.key,
            paymentReference: order.reference
          }
        });
        const now = new Date();
        const fulfilled = await tx.paymentOrder.update({
          where: { id: order.id },
          data: {
            status: 'FULFILLED',
            fulfilledAt: now,
            failureCode: null
          },
          include: { product: true, price: true, invoice: true }
        });
        await this.upsertPaidInvoice(tx, fulfilled, now);
        await tx.auditLog.create({
          data: {
            action: 'PAYMENT_ORDER_FULFILLED',
            entity: 'PaymentOrder',
            entityId: order.id,
            targetAccountId: order.userId,
            metadata: {
              provider: order.provider,
              productKey: order.product.key,
              fulfillmentType: 'KNOWCOINS',
              quantity: order.product.fulfillmentQuantity,
              ledgerEntryId: ledger.entry.id
            }
          }
        });
        return { order: fulfilled, replayed: false, ledgerEntry: ledger.entry };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    await this.audit.record({
      action: 'PAYMENT_FULFILLMENT_COMPLETE',
      entity: 'PaymentOrder',
      entityId: orderId,
      metadata: { fulfillmentType: 'KNOWCOINS' }
    });
    return result;
  }

  private async fulfillEntitlement(orderId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const order = await tx.paymentOrder.findUniqueOrThrow({
          where: { id: orderId },
          include: { product: true, price: true, invoice: true }
        });
        if (order.fulfilledAt) return { order, replayed: true };
        const existing = await tx.entitlementGrant.findFirst({
          where: {
            userId: order.userId,
            key: order.product.fulfillmentReference,
            source: 'PAYMENT',
            externalReference: order.id,
            revokedAt: null
          }
        });
        if (!existing) {
          await tx.entitlementGrant.create({
            data: {
              userId: order.userId,
              key: order.product.fulfillmentReference,
              source: 'PAYMENT',
              externalReference: order.id,
              reason: 'Droit attribué après paiement vérifié.',
              metadata: {
                productKey: order.product.key,
                provider: order.provider
              }
            }
          });
        }
        const now = new Date();
        const fulfilled = await tx.paymentOrder.update({
          where: { id: order.id },
          data: { status: 'FULFILLED', fulfilledAt: now, failureCode: null },
          include: { product: true, price: true, invoice: true }
        });
        await this.upsertPaidInvoice(tx, fulfilled, now);
        await tx.auditLog.create({
          data: {
            action: 'PAYMENT_ORDER_FULFILLED',
            entity: 'PaymentOrder',
            entityId: order.id,
            targetAccountId: order.userId,
            metadata: {
              provider: order.provider,
              productKey: order.product.key,
              fulfillmentType: 'ENTITLEMENT',
              entitlementKey: order.product.fulfillmentReference
            }
          }
        });
        return { order: fulfilled, replayed: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  private async fulfillSubscription(orderId: string, verification: Verification) {
    return this.prisma.$transaction(
      async (tx) => {
        const order = await tx.paymentOrder.findUniqueOrThrow({
          where: { id: orderId },
          include: { product: true, price: true, invoice: true }
        });
        if (order.fulfilledAt) return { order, replayed: true };
        const plan = await tx.billingPlan.findUnique({
          where: { key: order.product.fulfillmentReference },
          include: { entitlements: true }
        });
        if (!plan) throw new NotFoundException('Plan d’abonnement introuvable.');
        const now = new Date();
        const periodStart = 'periodStart' in verification && verification.periodStart
          ? verification.periodStart
          : now;
        const periodEnd = 'periodEnd' in verification && verification.periodEnd
          ? verification.periodEnd
          : this.defaultPeriodEnd(periodStart, order.product.metadata);
        if (periodEnd <= periodStart) {
          throw new BadRequestException('Période d’abonnement invalide.');
        }
        const externalTransactionId = verification.externalTransactionId;
        const externalSubscriptionId =
          'externalSubscriptionId' in verification && verification.externalSubscriptionId
            ? verification.externalSubscriptionId
            : order.reference;
        const subscription = await tx.billingSubscription.upsert({
          where: {
            provider_externalSubscriptionId: {
              provider: order.provider,
              externalSubscriptionId
            }
          },
          create: {
            userId: order.userId,
            planId: plan.id,
            provider: order.provider,
            externalSubscriptionId,
            status: 'ACTIVE',
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd:
              'cancelAtPeriodEnd' in verification
                ? verification.cancelAtPeriodEnd ?? false
                : false,
            latestEventTime: now,
            latestExternalEventId: externalTransactionId,
            metadata: {
              orderId: order.id,
              productKey: order.product.key,
              externalProductId: order.price.externalProductId
            }
          },
          update: {
            planId: plan.id,
            status: 'ACTIVE',
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd:
              'cancelAtPeriodEnd' in verification
                ? verification.cancelAtPeriodEnd ?? false
                : false,
            endedAt: null,
            latestEventTime: now,
            latestExternalEventId: externalTransactionId,
            metadata: {
              orderId: order.id,
              productKey: order.product.key,
              externalProductId: order.price.externalProductId
            }
          }
        });
        await this.syncEntitlements(
          tx,
          subscription.id,
          order.userId,
          plan.entitlements.map((entry) => entry.key),
          'ACTIVE',
          periodStart,
          periodEnd
        );
        const fulfilled = await tx.paymentOrder.update({
          where: { id: order.id },
          data: { status: 'FULFILLED', fulfilledAt: now, failureCode: null },
          include: { product: true, price: true, invoice: true }
        });
        await this.upsertPaidInvoice(tx, fulfilled, now);
        await tx.auditLog.create({
          data: {
            action: 'PAYMENT_ORDER_FULFILLED',
            entity: 'PaymentOrder',
            entityId: order.id,
            targetAccountId: order.userId,
            metadata: {
              provider: order.provider,
              productKey: order.product.key,
              fulfillmentType: 'BILLING_PLAN',
              planKey: plan.key,
              subscriptionId: subscription.id,
              currentPeriodEnd: periodEnd.toISOString()
            }
          }
        });
        return { order: fulfilled, subscription, replayed: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  private async syncEntitlements(
    tx: Prisma.TransactionClient,
    subscriptionId: string,
    userId: string,
    entitlementKeys: string[],
    status: string,
    periodStart: Date,
    periodEnd: Date
  ) {
    const now = new Date();
    const grantsAccess = ACCESS_STATUSES.has(status) && periodEnd > now;
    const active = await tx.entitlementGrant.findMany({
      where: {
        userId,
        source: 'SUBSCRIPTION',
        externalReference: subscriptionId,
        revokedAt: null
      }
    });
    if (!grantsAccess) {
      await tx.entitlementGrant.updateMany({
        where: { id: { in: active.map((entry) => entry.id) } },
        data: { revokedAt: now, reason: `Abonnement ${status.toLowerCase()}.` }
      });
      return;
    }
    for (const key of entitlementKeys) {
      const current = active.find((entry) => entry.key === key);
      if (current) {
        await tx.entitlementGrant.update({
          where: { id: current.id },
          data: { expiresAt: periodEnd, reason: 'Droit synchronisé depuis un paiement vérifié.' }
        });
      } else {
        await tx.entitlementGrant.create({
          data: {
            userId,
            key,
            source: 'SUBSCRIPTION',
            externalReference: subscriptionId,
            startsAt: periodStart,
            expiresAt: periodEnd,
            reason: 'Droit synchronisé depuis un paiement vérifié.',
            metadata: { subscriptionId, status }
          }
        });
      }
    }
  }

  private async upsertPaidInvoice(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      reference: string;
      expectedAmount: number;
      currency: string;
      userId: string;
      provider: string;
      product: { key: string };
    },
    paidAt: Date
  ) {
    const number = `KM-${paidAt.getUTCFullYear()}-${order.reference.replace(/[^A-Z0-9]/gi, '').slice(-18).toUpperCase()}`;
    return tx.paymentInvoice.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        number,
        status: 'PAID',
        subtotal: order.expectedAmount,
        total: order.expectedAmount,
        currency: order.currency,
        paidAt,
        metadata: {
          userId: order.userId,
          provider: order.provider,
          productKey: order.product.key
        }
      },
      update: { status: 'PAID', paidAt }
    });
  }

  private async isEligible(userId: string, requiresVerification: boolean) {
    if (!requiresVerification) return true;
    const approved = await this.prisma.identityVerificationRequest.findFirst({
      where: {
        userId,
        status: 'APPROVED',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      },
      select: { id: true }
    });
    return Boolean(approved);
  }

  private defaultPeriodEnd(start: Date, metadata: unknown) {
    const value = metadata && typeof metadata === 'object'
      ? (metadata as Record<string, unknown>)
      : {};
    const count = Number(value.intervalCount ?? 1);
    const end = new Date(start);
    if (value.interval === 'YEAR') end.setUTCFullYear(end.getUTCFullYear() + count);
    else if (value.interval === 'WEEK') end.setUTCDate(end.getUTCDate() + 7 * count);
    else if (value.interval === 'DAY') end.setUTCDate(end.getUTCDate() + count);
    else end.setUTCMonth(end.getUTCMonth() + count);
    return end;
  }
}
