import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { sha256Hex } from './payment-crypto';
import { PaymentOrchestrationService } from './payment-orchestration.service';
import {
  paymentAccountReference,
  redactPaymentPayload
} from './payment-security';
import { AppleStoreService } from './providers/apple-store.service';
import { CinetPayService } from './providers/cinetpay.service';
import { FlutterwaveService } from './providers/flutterwave.service';
import { GooglePlayService } from './providers/google-play.service';

@Injectable()
export class PaymentWebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestration: PaymentOrchestrationService,
    private readonly flutterwave: FlutterwaveService,
    private readonly cinetpay: CinetPayService,
    private readonly googlePlay: GooglePlayService,
    private readonly appleStore: AppleStoreService
  ) {}

  async flutterwaveWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>
  ) {
    const signature = this.header(headers, 'flutterwave-signature');
    const legacyHash = this.header(headers, 'verif-hash');
    const parsed = this.flutterwave.parseWebhook(rawBody);
    const valid = this.flutterwave.verifyWebhookSignature(
      rawBody,
      signature,
      legacyHash
    );
    const log = await this.persistWebhook({
      provider: 'FLUTTERWAVE',
      externalEventId: parsed.externalEventId,
      signatureValid: valid,
      rawBody,
      headers,
      payload: parsed.raw
    });
    if (!valid) {
      await this.rejectWebhook(log.id, 'INVALID_SIGNATURE');
      throw new UnauthorizedException('Signature Flutterwave invalide.');
    }
    if (log.replayed) return { accepted: true, replayed: true };
    if (!parsed.reference || !parsed.externalTransactionId) {
      await this.ignoreWebhook(log.id, 'MISSING_TRANSACTION_REFERENCE');
      return { accepted: true, ignored: true };
    }
    try {
      const result = await this.orchestration.verifyReferencedWebOrder(
        parsed.reference,
        parsed.externalTransactionId,
        parsed.externalEventId
      );
      await this.completeWebhook(log.id);
      return { accepted: true, result };
    } catch (error) {
      if (error instanceof NotFoundException) {
        await this.ignoreWebhook(log.id, 'UNKNOWN_ORDER');
        return { accepted: true, ignored: true };
      }
      await this.failWebhook(log.id, error);
      throw error;
    }
  }

  async cinetpayWebhook(
    rawBody: Buffer,
    payload: Record<string, unknown>,
    headers: Record<string, string | string[] | undefined>
  ) {
    const parsed = this.cinetpay.parseWebhook(payload, rawBody);
    const valid = this.cinetpay.verifyWebhookSignature(
      payload,
      this.header(headers, 'x-token')
    );
    const log = await this.persistWebhook({
      provider: 'CINETPAY',
      externalEventId: parsed.externalEventId,
      signatureValid: valid,
      rawBody,
      headers,
      payload
    });
    if (!valid) {
      await this.rejectWebhook(log.id, 'INVALID_SIGNATURE');
      throw new UnauthorizedException('Signature CinetPay invalide.');
    }
    if (log.replayed) return { accepted: true, replayed: true };
    if (!parsed.reference) {
      await this.ignoreWebhook(log.id, 'MISSING_TRANSACTION_REFERENCE');
      return { accepted: true, ignored: true };
    }
    try {
      const result = await this.orchestration.verifyReferencedWebOrder(
        parsed.reference,
        parsed.externalTransactionId ?? parsed.reference,
        parsed.externalEventId
      );
      await this.completeWebhook(log.id);
      return { accepted: true, result };
    } catch (error) {
      if (error instanceof NotFoundException) {
        await this.ignoreWebhook(log.id, 'UNKNOWN_ORDER');
        return { accepted: true, ignored: true };
      }
      await this.failWebhook(log.id, error);
      throw error;
    }
  }

  async googleWebhook(
    payload: Record<string, unknown>,
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>
  ) {
    await this.googlePlay.verifyPushAuthorization(
      this.header(headers, 'authorization')
    );
    const parsed = this.googlePlay.parseNotification(payload);
    const log = await this.persistWebhook({
      provider: 'GOOGLE_PLAY',
      externalEventId: parsed.externalEventId,
      signatureValid: true,
      rawBody,
      headers,
      payload: parsed.raw
    });
    if (log.replayed) return { accepted: true, replayed: true };
    const purchaseToken = this.googlePurchaseToken(parsed.raw);
    if (!purchaseToken) {
      await this.ignoreWebhook(log.id, 'TEST_OR_EMPTY_NOTIFICATION');
      return { accepted: true, ignored: true };
    }
    const proofHash = sha256Hex(`GOOGLE_PLAY:${purchaseToken}`);
    const order = await this.orchestration.providerOrderByProofHash(
      'GOOGLE_PLAY',
      proofHash
    );
    if (!order) {
      await this.ignoreWebhook(log.id, 'UNKNOWN_STORE_PURCHASE');
      return { accepted: true, ignored: true };
    }
    try {
      const verificationInput = {
        externalProductId: String(order.price.externalProductId),
        purchaseToken: this.orchestration.decryptStoreProof(order),
        expectedAccountReference: paymentAccountReference(
          order.userId,
          'GOOGLE_PLAY'
        ),
        kind: order.product.kind === 'SUBSCRIPTION'
          ? 'SUBSCRIPTION' as const
          : 'ONE_TIME' as const
      };
      const verification = await this.googlePlay.verifyPurchase(verificationInput);
      const result = await this.orchestration.applyVerification(
        order.id,
        verification,
        parsed.externalEventId
      );
      if (verification.status === 'SUCCESS' && result.order?.fulfilledAt) {
        await this.googlePlay.acknowledgePurchase(verificationInput);
      }
      await this.completeWebhook(log.id);
      return { accepted: true, result };
    } catch (error) {
      await this.failWebhook(log.id, error);
      throw error;
    }
  }

  async appleWebhook(
    payload: Record<string, unknown>,
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>
  ) {
    const parsed = this.appleStore.parseNotification(payload);
    const eventId = parsed.externalEventId || `apple-${sha256Hex(rawBody).slice(0, 48)}`;
    const log = await this.persistWebhook({
      provider: 'APPLE_APP_STORE',
      externalEventId: eventId,
      signatureValid: true,
      rawBody,
      headers,
      payload: parsed.raw
    });
    if (log.replayed) return { accepted: true, replayed: true };
    if (!parsed.externalTransactionId) {
      await this.ignoreWebhook(log.id, 'NOTIFICATION_WITHOUT_TRANSACTION');
      return { accepted: true, ignored: true };
    }
    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        provider: 'APPLE_APP_STORE',
        externalTransactionId: parsed.externalTransactionId
      },
      include: { order: { include: { product: true, price: true } } }
    });
    if (!attempt) {
      await this.ignoreWebhook(log.id, 'UNKNOWN_STORE_PURCHASE');
      return { accepted: true, ignored: true };
    }
    try {
      const verification = await this.appleStore.verifyPurchase({
        externalProductId: String(attempt.order.price.externalProductId),
        transactionId: parsed.externalTransactionId,
        expectedAccountReference: paymentAccountReference(
          attempt.order.userId,
          'APPLE_APP_STORE'
        ),
        kind: attempt.order.product.kind === 'SUBSCRIPTION'
          ? 'SUBSCRIPTION'
          : 'ONE_TIME'
      });
      const result = await this.orchestration.applyVerification(
        attempt.order.id,
        verification,
        eventId
      );
      await this.completeWebhook(log.id);
      return { accepted: true, result };
    } catch (error) {
      await this.failWebhook(log.id, error);
      throw error;
    }
  }

  private async persistWebhook(input: {
    provider: string;
    externalEventId: string;
    signatureValid: boolean;
    rawBody: Buffer;
    headers: Record<string, string | string[] | undefined>;
    payload: Record<string, unknown>;
  }) {
    const payloadHash = sha256Hex(input.rawBody);
    const existing = await this.prisma.paymentWebhookLog.findUnique({
      where: {
        provider_externalEventId: {
          provider: input.provider,
          externalEventId: input.externalEventId
        }
      }
    });
    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        await this.orchestration.recordFraud({
          provider: input.provider,
          type: 'WEBHOOK_EVENT_ID_COLLISION',
          severity: 'CRITICAL',
          details: { externalEventId: input.externalEventId }
        });
        throw new ConflictException(
          'Cet identifiant webhook existe avec un contenu différent.'
        );
      }
      const updated = await this.prisma.paymentWebhookLog.update({
        where: { id: existing.id },
        data: { attempts: { increment: 1 } }
      });
      return { ...updated, replayed: true };
    }
    const created = await this.prisma.paymentWebhookLog.create({
      data: {
        provider: input.provider,
        externalEventId: input.externalEventId,
        signatureValid: input.signatureValid,
        payloadHash,
        headers: redactPaymentPayload(input.headers) as Prisma.InputJsonValue,
        payload: redactPaymentPayload(input.payload) as Prisma.InputJsonValue
      }
    });
    return { ...created, replayed: false };
  }

  private completeWebhook(id: string) {
    return this.prisma.paymentWebhookLog.update({
      where: { id },
      data: { status: 'PROCESSED', processedAt: new Date(), errorCode: null }
    });
  }

  private ignoreWebhook(id: string, reason: string) {
    return this.prisma.paymentWebhookLog.update({
      where: { id },
      data: { status: 'IGNORED', processedAt: new Date(), errorCode: reason }
    });
  }

  private rejectWebhook(id: string, reason: string) {
    return this.prisma.paymentWebhookLog.update({
      where: { id },
      data: { status: 'REJECTED', processedAt: new Date(), errorCode: reason }
    });
  }

  private failWebhook(id: string, error: unknown) {
    return this.prisma.paymentWebhookLog.update({
      where: { id },
      data: {
        status: 'FAILED',
        errorCode: error instanceof Error ? error.constructor.name : 'UNKNOWN_ERROR'
      }
    });
  }

  private header(
    headers: Record<string, string | string[] | undefined>,
    name: string
  ) {
    const value = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  }

  private googlePurchaseToken(payload: Record<string, unknown>) {
    const subscription = (payload.subscriptionNotification ?? {}) as Record<string, unknown>;
    const product = (payload.oneTimeProductNotification ?? {}) as Record<string, unknown>;
    const token = subscription.purchaseToken ?? product.purchaseToken;
    return token ? String(token) : null;
  }
}
