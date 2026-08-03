import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class PaymentReversalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService
  ) {}

  async reverse(orderId: string, refundId: string) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const refund = await tx.paymentRefund.findUnique({
            where: { id: refundId }
          });
          const order = await tx.paymentOrder.findUnique({
            where: { id: orderId },
            include: { product: true, invoice: true }
          });
          if (!refund || !order || refund.orderId !== order.id) {
            throw new NotFoundException('Remboursement ou commande introuvable.');
          }
          if (refund.completedAt && order.status === 'REFUNDED') {
            return { order, refund, replayed: true };
          }
          if (!order.fulfilledAt) {
            throw new BadRequestException(
              'Une commande non attribuée ne nécessite pas de compensation.'
            );
          }
          if (refund.amount !== order.expectedAmount) {
            throw new BadRequestException(
              'KMD-032 ne compense automatiquement que les remboursements intégraux.'
            );
          }

          if (order.product.fulfillmentType === 'KNOWCOINS') {
            await this.wallet.applyInTransaction(tx, {
              userId: order.userId,
              amount: -order.product.fulfillmentQuantity,
              type: 'PAYMENT_REFUND_DEBIT',
              source: 'PAYMENT_REFUND',
              idempotencyKey: `payment-refund:${refund.id}:knowcoins`,
              referenceType: 'PaymentRefund',
              referenceId: refund.id,
              reason: 'Débit compensatoire après remboursement confirmé.',
              metadata: {
                orderId: order.id,
                provider: order.provider,
                productKey: order.product.key
              }
            });
          } else if (order.product.fulfillmentType === 'ENTITLEMENT') {
            await tx.entitlementGrant.updateMany({
              where: {
                userId: order.userId,
                key: order.product.fulfillmentReference,
                source: 'PAYMENT',
                externalReference: order.id,
                revokedAt: null
              },
              data: {
                revokedAt: new Date(),
                reason: 'Droit révoqué après remboursement confirmé.'
              }
            });
          } else if (order.product.fulfillmentType === 'BILLING_PLAN') {
            const subscription = await tx.billingSubscription.findFirst({
              where: {
                userId: order.userId,
                provider: order.provider,
                metadata: {
                  path: ['orderId'],
                  equals: order.id
                }
              },
              orderBy: { updatedAt: 'desc' }
            });
            if (subscription) {
              await tx.billingSubscription.update({
                where: { id: subscription.id },
                data: {
                  status: 'REFUNDED',
                  endedAt: new Date(),
                  cancelAtPeriodEnd: false
                }
              });
              await tx.entitlementGrant.updateMany({
                where: {
                  userId: order.userId,
                  source: 'SUBSCRIPTION',
                  externalReference: subscription.id,
                  revokedAt: null
                },
                data: {
                  revokedAt: new Date(),
                  reason: 'Abonnement remboursé.'
                }
              });
            }
          } else {
            throw new BadRequestException('Attribution commerciale non compensable.');
          }

          const completedAt = new Date();
          const [updatedOrder, updatedRefund] = await Promise.all([
            tx.paymentOrder.update({
              where: { id: order.id },
              data: {
                status: 'REFUNDED',
                failureCode: null
              },
              include: { product: true, price: true, invoice: true }
            }),
            tx.paymentRefund.update({
              where: { id: refund.id },
              data: {
                status: 'COMPLETED',
                completedAt
              }
            })
          ]);
          if (order.invoice) {
            await tx.paymentInvoice.update({
              where: { orderId: order.id },
              data: {
                status: 'REFUNDED',
                refundedAt: completedAt
              }
            });
          }
          await tx.auditLog.create({
            data: {
              action: 'PAYMENT_REFUND_FULFILLMENT_REVERSED',
              entity: 'PaymentRefund',
              entityId: refund.id,
              targetAccountId: order.userId,
              metadata: {
                orderId: order.id,
                provider: order.provider,
                productKey: order.product.key,
                fulfillmentType: order.product.fulfillmentType,
                amount: refund.amount,
                currency: refund.currency
              }
            }
          });
          return {
            order: updatedOrder,
            refund: updatedRefund,
            replayed: false
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (
        error instanceof BadRequestException &&
        error.message.includes('Solde KnowCoins insuffisant')
      ) {
        await Promise.all([
          this.prisma.paymentRefund.update({
            where: { id: refundId },
            data: { status: 'RECOVERY_REQUIRED' }
          }),
          this.prisma.paymentFraudLog.create({
            data: {
              orderId,
              type: 'REFUND_KNOWCOINS_ALREADY_SPENT',
              severity: 'HIGH',
              details: { refundId }
            }
          })
        ]);
      }
      throw error;
    }
  }
}
