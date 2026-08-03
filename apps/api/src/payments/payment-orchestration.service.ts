import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CommerceCatalogService } from './commerce-catalog.service';
import {
  CreatePaymentOrderDto,
  VerifyStorePurchaseDto
} from './dto/payments.dto';
import { PaymentFulfillmentService } from './payment-fulfillment.service';
import {
  PaymentProvider,
  VerifiedProviderPayment,
  VerifiedStorePurchase
} from './payment-provider.types';
import { PaymentSecretBoxService } from './payment-secret-box.service';
import {
  createPaymentReference,
  hashNetworkValue,
  paymentAccountReference,
  redactPaymentPayload
} from './payment-security';
import { sha256Hex } from './payment-crypto';
import { AppleStoreService } from './providers/apple-store.service';
import { CinetPayService } from './providers/cinetpay.service';
import { FlutterwaveService } from './providers/flutterwave.service';
import { GooglePlayService } from './providers/google-play.service';

type RequestContext = {
  ipAddress?: string;
  userAgent?: string;
};

type Verification = VerifiedProviderPayment | VerifiedStorePurchase;

@Injectable()
export class PaymentOrchestrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly catalogService: CommerceCatalogService,
    private readonly fulfillment: PaymentFulfillmentService,
    private readonly secretBox: PaymentSecretBoxService,
    private readonly flutterwave: FlutterwaveService,
    private readonly cinetpay: CinetPayService,
    private readonly googlePlay: GooglePlayService,
    private readonly appleStore: AppleStoreService,
    private readonly audit: AuditService
  ) {}

  catalog(platform?: string, country?: string, currency?: string) {
    return this.catalogService.catalog(platform, country, currency);
  }

  providerConfiguration() {
    return {
      providers: {
        FLUTTERWAVE: {
          configured: this.flutterwave.configured(),
          platform: 'WEB'
        },
        CINETPAY: {
          configured: this.cinetpay.configured(),
          platform: 'WEB'
        },
        GOOGLE_PLAY: {
          configured: this.googlePlay.configured() && this.secretBox.configured(),
          platform: 'ANDROID'
        },
        APPLE_APP_STORE: {
          configured: this.appleStore.configured() && this.secretBox.configured(),
          platform: 'IOS'
        }
      },
      pricesAreServerAuthoritative: true,
      clientAmountsAccepted: false,
      rawPaymentCredentialsStored: false,
      storeProofsEncryptedAtRest: true
    };
  }

  async createWebCheckout(
    userId: string,
    idempotencyKeyValue: string | undefined,
    dto: CreatePaymentOrderDto,
    context: RequestContext
  ) {
    const idempotencyKey = this.requireIdempotencyKey(idempotencyKeyValue);
    const existing = await this.prisma.paymentOrder.findUnique({
      where: { idempotencyKey },
      include: { product: true, price: true }
    });
    if (existing) {
      this.assertReplayMatches(existing, userId, dto.productKey, dto.provider);
      return { order: this.publicOrder(existing), replayed: true };
    }

    const [{ product, price }, user] = await Promise.all([
      this.catalogService.resolveWebPrice(dto),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, displayName: true }
      })
    ]);
    if (!user) throw new NotFoundException('Compte utilisateur introuvable.');
    await this.assertProductEligibility(userId, product.requiresVerification);
    this.assertProviderConfigured(dto.provider);

    const reference = createPaymentReference(dto.provider);
    const expiresAt = new Date(Date.now() + 30 * 60_000);
    const publicApiUrl = this.requireUrl('PAYMENTS_PUBLIC_API_URL');
    const returnUrl = this.requireUrl('PAYMENTS_RETURN_URL');
    const notifyUrl = `${publicApiUrl.replace(/\/$/, '')}/api/webhooks/${
      dto.provider === 'FLUTTERWAVE' ? 'flutterwave' : 'cinetpay'
    }`;
    const salt = this.config.get<string>('PAYMENTS_FRAUD_HASH_SALT')?.trim();

    let order;
    try {
      order = await this.prisma.paymentOrder.create({
        data: {
          userId,
          productId: product.id,
          priceId: price.id,
          provider: dto.provider,
          platform: 'WEB',
          status: 'CREATED',
          expectedAmount: price.unitAmount,
          currency: price.currency,
          countryCode: dto.countryCode?.trim().toUpperCase() ?? null,
          reference,
          idempotencyKey,
          returnUrl,
          expiresAt,
          metadata: {
            ipHash: salt ? hashNetworkValue(context.ipAddress, salt) : null,
            userAgentHash: salt
              ? hashNetworkValue(context.userAgent, salt)
              : null
          }
        },
        include: { product: true, price: true }
      });
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        const replay = await this.prisma.paymentOrder.findUnique({
          where: { idempotencyKey },
          include: { product: true, price: true }
        });
        if (replay) {
          this.assertReplayMatches(replay, userId, dto.productKey, dto.provider);
          return { order: this.publicOrder(replay), replayed: true };
        }
      }
      throw error;
    }

    try {
      const providerInput = {
        reference,
        amount: price.unitAmount,
        currency: price.currency,
        description: product.name,
        returnUrl,
        notifyUrl,
        customer: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          phoneNumber: dto.phoneNumber,
          address: dto.address,
          city: dto.city,
          countryCode: dto.customerCountryCode,
          state: dto.state,
          postalCode: dto.postalCode
        },
        metadata: {
          orderId: order.id,
          accountId: userId,
          productKey: product.key
        }
      };
      const checkout = dto.provider === 'FLUTTERWAVE'
        ? await this.flutterwave.createPayment(providerInput)
        : await this.cinetpay.createPayment(providerInput);
      const pending = await this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: {
          status: 'PENDING',
          providerCheckoutId: checkout.providerCheckoutId,
          checkoutUrl: checkout.checkoutUrl,
          metadata: {
            ...(order.metadata as Record<string, unknown> | null),
            providerResponse: redactPaymentPayload(checkout.raw)
          }
        },
        include: { product: true, price: true }
      });
      await this.audit.record({
        actorId: userId,
        action: 'PAYMENT_CHECKOUT_CREATED',
        entity: 'PaymentOrder',
        entityId: order.id,
        targetAccountId: userId,
        metadata: {
          provider: dto.provider,
          productKey: product.key,
          amount: price.unitAmount,
          currency: price.currency,
          reference
        }
      });
      return { order: this.publicOrder(pending), replayed: false };
    } catch (error) {
      await this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: {
          status: 'INIT_FAILED',
          failureCode:
            error instanceof Error ? error.constructor.name : 'PROVIDER_INIT_FAILED'
        }
      });
      throw error;
    }
  }

  async verifyWebOrder(
    userId: string,
    orderId: string,
    externalTransactionId: string
  ) {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { id: orderId },
      include: { product: true, price: true }
    });
    if (!order || order.userId !== userId) {
      throw new NotFoundException('Commande de paiement introuvable.');
    }
    if (!['FLUTTERWAVE', 'CINETPAY'].includes(order.provider)) {
      throw new BadRequestException('Cette commande n’est pas un paiement Web.');
    }
    const verification = await this.verifyWebProvider(order, externalTransactionId);
    return this.applyVerification(order.id, verification);
  }

  async verifyStorePurchase(
    userId: string,
    dto: VerifyStorePurchaseDto,
    context: RequestContext
  ) {
    const { product, price } = await this.catalogService.resolveStorePrice(dto);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });
    if (!user) throw new NotFoundException('Compte utilisateur introuvable.');
    await this.assertProductEligibility(userId, product.requiresVerification);
    this.assertProviderConfigured(dto.provider);

    const proof = dto.provider === 'GOOGLE_PLAY'
      ? dto.purchaseToken!
      : dto.transactionId!;
    const proofHash = sha256Hex(`${dto.provider}:${proof}`);
    const idempotencyKey = `store:${dto.provider.toLowerCase()}:${proofHash}`;
    const existing = await this.prisma.paymentOrder.findUnique({
      where: { idempotencyKey },
      include: { product: true, price: true }
    });
    if (existing) {
      if (existing.userId !== userId || existing.product.key !== product.key) {
        await this.recordFraud({
          userId,
          orderId: existing.id,
          provider: dto.provider,
          type: 'STORE_PROOF_REUSE',
          severity: 'CRITICAL',
          details: { requestedProduct: product.key }
        });
        throw new UnauthorizedException(
          'Cette preuve d’achat est déjà liée à un autre compte ou produit.'
        );
      }
      return { order: this.publicOrder(existing), replayed: true };
    }

    const reference = createPaymentReference(dto.provider);
    const salt = this.config.get<string>('PAYMENTS_FRAUD_HASH_SALT')?.trim();
    const order = await this.prisma.paymentOrder.create({
      data: {
        userId,
        productId: product.id,
        priceId: price.id,
        provider: dto.provider,
        platform: dto.provider === 'GOOGLE_PLAY' ? 'ANDROID' : 'IOS',
        status: 'PENDING',
        expectedAmount: price.unitAmount,
        currency: price.currency,
        countryCode: price.countryCode,
        reference,
        idempotencyKey,
        providerCheckoutId: proofHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
        metadata: {
          encryptedProof: this.secretBox.encrypt(proof, `payment-order:${reference}`),
          proofHash,
          externalProductId: dto.externalProductId,
          ipHash: salt ? hashNetworkValue(context.ipAddress, salt) : null,
          userAgentHash: salt
            ? hashNetworkValue(context.userAgent, salt)
            : null
        }
      },
      include: { product: true, price: true }
    });

    const verificationInput = {
      externalProductId: dto.externalProductId,
      purchaseToken: dto.purchaseToken,
      transactionId: dto.transactionId,
      expectedAccountReference: paymentAccountReference(userId, dto.provider),
      kind: product.kind === 'SUBSCRIPTION' ? 'SUBSCRIPTION' as const : 'ONE_TIME' as const
    };
    const verification = dto.provider === 'GOOGLE_PLAY'
      ? await this.googlePlay.verifyPurchase(verificationInput)
      : await this.appleStore.verifyPurchase(verificationInput);
    const result = await this.applyVerification(order.id, verification);

    if (
      dto.provider === 'GOOGLE_PLAY' &&
      verification.status === 'SUCCESS' &&
      result.order?.fulfilledAt
    ) {
      await this.googlePlay.acknowledgePurchase(verificationInput);
    }
    return { ...result, replayed: false };
  }

  async ordersForUser(userId: string, cursor?: string, limit = 30) {
    const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
    const orders = await this.prisma.paymentOrder.findMany({
      where: { userId },
      take: safeLimit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: { product: true, price: true, invoice: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });
    const hasMore = orders.length > safeLimit;
    const items = hasMore ? orders.slice(0, safeLimit) : orders;
    return {
      items: items.map((entry) => this.publicOrder(entry)),
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null
    };
  }

  async orderForUser(userId: string, orderId: string) {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { id: orderId },
      include: {
        product: true,
        price: true,
        invoice: true,
        attempts: { orderBy: { createdAt: 'desc' } },
        refunds: { orderBy: { createdAt: 'desc' } }
      }
    });
    if (!order || order.userId !== userId) {
      throw new NotFoundException('Commande de paiement introuvable.');
    }
    return this.publicOrder(order);
  }

  async verifyReferencedWebOrder(
    reference: string,
    externalTransactionId: string,
    externalEventId?: string
  ) {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { reference },
      include: { product: true, price: true }
    });
    if (!order) {
      await this.recordFraud({
        provider: 'UNKNOWN',
        type: 'UNKNOWN_PAYMENT_REFERENCE',
        severity: 'HIGH',
        details: { reference, externalEventId }
      });
      throw new NotFoundException('Référence de paiement inconnue.');
    }
    const verification = await this.verifyWebProvider(order, externalTransactionId);
    return this.applyVerification(order.id, verification, externalEventId);
  }

  async applyVerification(
    orderId: string,
    verification: Verification,
    externalEventId?: string
  ) {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { id: orderId },
      include: { product: true, price: true }
    });
    if (!order) throw new NotFoundException('Commande de paiement introuvable.');

    if ('reference' in verification) {
      const mismatches = {
        reference: verification.reference !== order.reference,
        amount: verification.amount !== order.expectedAmount,
        currency: verification.currency !== order.currency
      };
      if (Object.values(mismatches).some(Boolean)) {
        await this.recordAttempt(order.id, verification, externalEventId, 'REJECTED', 'PAYMENT_MISMATCH');
        await this.prisma.paymentOrder.update({
          where: { id: order.id },
          data: { status: 'REVIEW_REQUIRED', failureCode: 'PAYMENT_MISMATCH' }
        });
        await this.recordFraud({
          userId: order.userId,
          orderId: order.id,
          provider: order.provider,
          type: 'PAYMENT_MISMATCH',
          severity: 'CRITICAL',
          details: {
            mismatches,
            expectedAmount: order.expectedAmount,
            actualAmount: verification.amount,
            expectedCurrency: order.currency,
            actualCurrency: verification.currency
          }
        });
        throw new UnauthorizedException(
          'Le paiement vérifié ne correspond pas à la commande KnowMe.'
        );
      }
    }

    await this.recordAttempt(
      order.id,
      verification,
      externalEventId,
      verification.status === 'SUCCESS' ? 'VERIFIED' : verification.status
    );

    if (verification.status === 'SUCCESS') {
      await this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: { status: 'PAID', failureCode: null }
      });
      const fulfilled = await this.fulfillment.fulfill(order.id, verification);
      const current = await this.prisma.paymentOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: { product: true, price: true, invoice: true }
      });
      return {
        order: this.publicOrder(current),
        fulfillment: fulfilled
      };
    }

    const status = verification.status === 'PENDING'
      ? 'PENDING'
      : verification.status === 'CANCELED'
        ? 'CANCELED'
        : verification.status === 'REFUNDED'
          ? 'REFUNDED'
          : 'FAILED';
    const current = await this.prisma.paymentOrder.update({
      where: { id: order.id },
      data: { status, failureCode: verification.rawStatus },
      include: { product: true, price: true, invoice: true }
    });
    return { order: this.publicOrder(current) };
  }

  async providerOrderByProofHash(provider: PaymentProvider, proofHash: string) {
    return this.prisma.paymentOrder.findFirst({
      where: { provider, providerCheckoutId: proofHash },
      include: { product: true, price: true }
    });
  }

  decryptStoreProof(order: { reference: string; metadata: unknown }) {
    const metadata = order.metadata && typeof order.metadata === 'object'
      ? order.metadata as Record<string, unknown>
      : {};
    const encrypted = String(metadata.encryptedProof ?? '');
    if (!encrypted) throw new ServiceUnavailableException('Preuve mobile indisponible.');
    return this.secretBox.decrypt(encrypted, `payment-order:${order.reference}`);
  }

  private async verifyWebProvider(
    order: {
      provider: string;
      reference: string;
      expectedAmount: number;
      currency: string;
    },
    externalTransactionId: string
  ) {
    const input = {
      externalTransactionId,
      expectedReference: order.reference,
      expectedAmount: order.expectedAmount,
      expectedCurrency: order.currency
    };
    if (order.provider === 'FLUTTERWAVE') {
      return this.flutterwave.verifyPayment(input);
    }
    if (order.provider === 'CINETPAY') {
      return this.cinetpay.verifyPayment(input);
    }
    throw new BadRequestException('Fournisseur Web invalide.');
  }

  private async recordAttempt(
    orderId: string,
    verification: Verification,
    externalEventId: string | undefined,
    status: string,
    failureCode?: string
  ) {
    const externalTransactionId = verification.externalTransactionId;
    const payloadHash = sha256Hex(JSON.stringify(verification.raw));
    try {
      return await this.prisma.paymentAttempt.create({
        data: {
          orderId,
          provider: (await this.prisma.paymentOrder.findUniqueOrThrow({
            where: { id: orderId },
            select: { provider: true }
          })).provider,
          status,
          externalTransactionId,
          externalEventId: externalEventId ?? verification.externalEventId,
          amount: 'amount' in verification ? verification.amount : null,
          currency: 'currency' in verification ? verification.currency : null,
          rawStatus: verification.rawStatus,
          payloadHash,
          verifiedAt: new Date(),
          failureCode: failureCode ?? null,
          metadata: redactPaymentPayload(verification.raw) as Prisma.InputJsonValue
        }
      });
    } catch (error) {
      if (!this.isUniqueConflict(error)) throw error;
      const duplicate = await this.prisma.paymentAttempt.findFirst({
        where: {
          OR: [
            { provider: (await this.prisma.paymentOrder.findUniqueOrThrow({ where: { id: orderId }, select: { provider: true } })).provider, externalTransactionId },
            ...(externalEventId
              ? [{ provider: (await this.prisma.paymentOrder.findUniqueOrThrow({ where: { id: orderId }, select: { provider: true } })).provider, externalEventId }]
              : [])
          ]
        }
      });
      if (duplicate && duplicate.orderId !== orderId) {
        await this.recordFraud({
          orderId,
          type: 'PROVIDER_TRANSACTION_REUSE',
          severity: 'CRITICAL',
          details: { duplicateOrderId: duplicate.orderId, externalTransactionId }
        });
        throw new ConflictException(
          'Cette transaction fournisseur appartient déjà à une autre commande.'
        );
      }
      return duplicate;
    }
  }

  private async assertProductEligibility(
    userId: string,
    requiresVerification: boolean
  ) {
    if (!requiresVerification) return;
    const approved = await this.prisma.identityVerificationRequest.findFirst({
      where: {
        userId,
        status: 'APPROVED',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      },
      select: { id: true }
    });
    if (!approved) {
      throw new ForbiddenException(
        'Une vérification d’identité approuvée est requise avant cet achat.'
      );
    }
  }

  private assertProviderConfigured(provider: PaymentProvider) {
    const configured = provider === 'FLUTTERWAVE'
      ? this.flutterwave.configured()
      : provider === 'CINETPAY'
        ? this.cinetpay.configured()
        : provider === 'GOOGLE_PLAY'
          ? this.googlePlay.configured() && this.secretBox.configured()
          : this.appleStore.configured() && this.secretBox.configured();
    if (!configured) {
      throw new ServiceUnavailableException(
        `${provider} est désactivé tant que sa configuration n’est pas complète.`
      );
    }
  }

  private requireIdempotencyKey(value: string | undefined) {
    const key = value?.trim();
    if (!key || !/^[A-Za-z0-9._:-]{8,160}$/.test(key)) {
      throw new BadRequestException('En-tête Idempotency-Key invalide ou manquant.');
    }
    return key;
  }

  private requireUrl(name: string) {
    const value = this.config.get<string>(name)?.trim();
    if (!value || !/^https?:\/\//.test(value)) {
      throw new ServiceUnavailableException(`${name} n’est pas configuré.`);
    }
    return value;
  }

  private assertReplayMatches(
    order: { userId: string; provider: string; product: { key: string } },
    userId: string,
    productKey: string,
    provider: string
  ) {
    if (
      order.userId !== userId ||
      order.product.key !== productKey.trim().toLowerCase() ||
      order.provider !== provider
    ) {
      throw new ConflictException(
        'Cette clé d’idempotence appartient à une autre commande.'
      );
    }
  }

  private publicOrder(order: Record<string, any>) {
    const metadata = order.metadata && typeof order.metadata === 'object'
      ? { ...order.metadata }
      : null;
    if (metadata) {
      delete metadata.encryptedProof;
      delete metadata.providerResponse;
    }
    return {
      id: order.id,
      productKey: order.product?.key,
      productName: order.product?.name,
      provider: order.provider,
      platform: order.platform,
      status: order.status,
      expectedAmount: order.expectedAmount,
      currency: order.currency,
      countryCode: order.countryCode,
      reference: order.reference,
      checkoutUrl: order.checkoutUrl,
      expiresAt: order.expiresAt,
      fulfilledAt: order.fulfilledAt,
      failureCode: order.failureCode,
      invoice: order.invoice
        ? {
            number: order.invoice.number,
            status: order.invoice.status,
            total: order.invoice.total,
            currency: order.invoice.currency,
            issuedAt: order.invoice.issuedAt,
            paidAt: order.invoice.paidAt,
            refundedAt: order.invoice.refundedAt
          }
        : null,
      attempts: order.attempts?.map((attempt: Record<string, any>) => ({
        id: attempt.id,
        status: attempt.status,
        rawStatus: attempt.rawStatus,
        verifiedAt: attempt.verifiedAt,
        createdAt: attempt.createdAt
      })),
      refunds: order.refunds?.map((refund: Record<string, any>) => ({
        id: refund.id,
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status,
        createdAt: refund.createdAt,
        completedAt: refund.completedAt
      })),
      metadata,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };
  }

  async recordFraud(input: {
    userId?: string;
    orderId?: string;
    provider?: string;
    type: string;
    severity: string;
    details?: Record<string, unknown>;
  }) {
    return this.prisma.paymentFraudLog.create({
      data: {
        userId: input.userId ?? null,
        orderId: input.orderId ?? null,
        provider: input.provider ?? null,
        type: input.type,
        severity: input.severity,
        details: input.details as Prisma.InputJsonValue | undefined
      }
    });
  }

  private isUniqueConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
