import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConfirmPaymentRefundDto,
  RequestPaymentRefundDto
} from './dto/payments.dto';
import { PaymentReversalService } from './payment-reversal.service';
import { redactPaymentPayload } from './payment-security';
import { FlutterwaveService } from './providers/flutterwave.service';

@Injectable()
export class PaymentRefundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flutterwave: FlutterwaveService,
    private readonly reversal: PaymentReversalService,
    private readonly audit: AuditService
  ) {}

  async requestRefund(
    actorId: string,
    orderId: string,
    dto: RequestPaymentRefundDto
  ) {
    const existing = await this.prisma.paymentRefund.findUnique({
      where: { idempotencyKey: dto.idempotencyKey }
    });
    if (existing) {
      if (
        existing.orderId !== orderId ||
        existing.amount !== dto.amount ||
        existing.requestedById !== actorId
      ) {
        throw new ConflictException(
          'Cette clé d’idempotence appartient à un autre remboursement.'
        );
      }
      return { refund: existing, replayed: true };
    }

    const order = await this.prisma.paymentOrder.findUnique({
      where: { id: orderId },
      include: {
        product: true,
        attempts: {
          where: { status: 'VERIFIED' },
          orderBy: { verifiedAt: 'desc' },
          take: 1
        }
      }
    });
    if (!order) throw new NotFoundException('Commande de paiement introuvable.');
    if (!order.fulfilledAt || !['FULFILLED', 'PAID'].includes(order.status)) {
      throw new BadRequestException(
        'Seule une commande payée et attribuée peut être remboursée.'
      );
    }
    if (dto.amount !== order.expectedAmount) {
      throw new BadRequestException(
        'KMD-032 autorise uniquement le remboursement intégral d’une commande.'
      );
    }
    const alreadyRefunded = await this.prisma.paymentRefund.aggregate({
      where: {
        orderId,
        status: { in: ['REQUESTED', 'PROCESSING', 'PROVIDER_MANAGED', 'COMPLETED'] }
      },
      _sum: { amount: true }
    });
    if ((alreadyRefunded._sum.amount ?? 0) + dto.amount > order.expectedAmount) {
      throw new ConflictException('Cette commande possède déjà un remboursement actif.');
    }
    const attempt = order.attempts[0];
    if (!attempt?.externalTransactionId) {
      throw new BadRequestException(
        'Aucune transaction fournisseur vérifiée ne permet ce remboursement.'
      );
    }

    const initialStatus = order.provider === 'FLUTTERWAVE'
      ? 'REQUESTED'
      : 'PROVIDER_MANAGED';
    const refund = await this.prisma.paymentRefund.create({
      data: {
        orderId,
        attemptId: attempt.id,
        provider: order.provider,
        amount: dto.amount,
        currency: order.currency,
        status: initialStatus,
        reason: dto.reason.trim(),
        idempotencyKey: dto.idempotencyKey,
        requestedById: actorId
      }
    });

    if (order.provider === 'FLUTTERWAVE') {
      try {
        const providerRefund = await this.flutterwave.refundPayment({
          externalTransactionId: attempt.externalTransactionId,
          amount: dto.amount,
          currency: order.currency,
          reason: dto.reason.trim()
        });
        const updated = await this.prisma.paymentRefund.update({
          where: { id: refund.id },
          data: {
            externalRefundId: providerRefund.externalRefundId,
            status: 'PROCESSING',
            metadata: redactPaymentPayload(providerRefund.raw) as Prisma.InputJsonValue
          }
        });
        await this.auditRefund(actorId, order, updated, 'PAYMENT_REFUND_SUBMITTED');
        return { refund: updated, replayed: false };
      } catch (error) {
        await this.prisma.paymentRefund.update({
          where: { id: refund.id },
          data: {
            status: 'FAILED',
            metadata: {
              failure: error instanceof Error
                ? error.constructor.name
                : 'UNKNOWN_ERROR'
            }
          }
        });
        throw error;
      }
    }

    await this.auditRefund(actorId, order, refund, 'PAYMENT_REFUND_PROVIDER_MANAGED');
    return {
      refund,
      replayed: false,
      instructions:
        order.provider === 'CINETPAY'
          ? 'Le remboursement doit être exécuté dans le canal marchand CinetPay, puis confirmé avec sa référence externe.'
          : 'Le remboursement doit être exécuté par Google Play ou Apple App Store, puis confirmé par notification serveur ou référence externe.'
    };
  }

  async confirmExternalRefund(
    actorId: string,
    refundId: string,
    dto: ConfirmPaymentRefundDto
  ) {
    const refund = await this.prisma.paymentRefund.findUnique({
      where: { id: refundId },
      include: { order: { include: { product: true } } }
    });
    if (!refund) throw new NotFoundException('Remboursement introuvable.');
    if (refund.completedAt) {
      return this.reversal.reverse(refund.orderId, refund.id);
    }
    if (refund.provider === 'FLUTTERWAVE' && refund.status !== 'PROCESSING') {
      throw new BadRequestException(
        'Un remboursement Flutterwave doit avoir été soumis avant confirmation.'
      );
    }
    const confirmed = await this.prisma.paymentRefund.update({
      where: { id: refund.id },
      data: {
        externalRefundId: dto.externalRefundId,
        status: 'CONFIRMED',
        metadata: {
          ...(refund.metadata as Record<string, unknown> | null),
          evidenceReference: dto.evidenceReference.trim(),
          confirmedById: actorId,
          confirmedAt: new Date().toISOString()
        }
      }
    });
    await this.auditRefund(
      actorId,
      refund.order,
      confirmed,
      'PAYMENT_REFUND_CONFIRMED'
    );
    return this.reversal.reverse(refund.orderId, refund.id);
  }

  async listRefunds(status?: string, provider?: string, userId?: string) {
    return this.prisma.paymentRefund.findMany({
      where: {
        ...(status ? { status: status.trim().toUpperCase() } : {}),
        ...(provider ? { provider: provider.trim().toUpperCase() } : {}),
        ...(userId ? { order: { userId: userId.trim() } } : {})
      },
      include: {
        order: {
          include: {
            product: true,
            price: true
          }
        },
        attempt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
  }

  private auditRefund(
    actorId: string,
    order: {
      id: string;
      userId: string;
      provider: string;
      expectedAmount: number;
      currency: string;
      product: { key: string };
    },
    refund: {
      id: string;
      status: string;
      amount: number;
      externalRefundId: string | null;
    },
    action: string
  ) {
    return this.audit.record({
      actorId,
      action,
      entity: 'PaymentRefund',
      entityId: refund.id,
      targetAccountId: order.userId,
      metadata: {
        orderId: order.id,
        provider: order.provider,
        productKey: order.product.key,
        amount: refund.amount,
        currency: order.currency,
        status: refund.status,
        externalRefundId: refund.externalRefundId
      }
    });
  }
}
