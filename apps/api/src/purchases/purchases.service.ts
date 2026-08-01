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
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { IntegrityService } from '../integrity/integrity.service';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import {
  UpsertStoreProductDto,
  VerifyPurchaseDto
} from './dto/purchase.dto';

type VerifiedReceipt = {
  transactionId: string;
  originalTransactionId?: string;
  externalProductId: string;
  status: 'PURCHASED';
  purchasedAt: Date;
  expiresAt?: Date;
  metadata: Prisma.InputJsonValue;
};

type TestReceiptPayload = {
  transactionId: string;
  originalTransactionId?: string;
  externalProductId: string;
  status: string;
  purchasedAt: string;
  expiresAt?: string;
};

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly integrity: IntegrityService,
    private readonly wallet: WalletService,
    private readonly audit: AuditService
  ) {}

  listProducts() {
    return this.prisma.storeProduct.findMany({
      where: { active: true },
      select: {
        id: true,
        key: true,
        provider: true,
        platform: true,
        externalProductId: true,
        name: true,
        description: true,
        kind: true,
        entitlementKey: true,
        coinAmount: true,
        durationDays: true
      },
      orderBy: [{ platform: 'asc' }, { key: 'asc' }]
    });
  }

  listMine(userId: string) {
    return this.prisma.purchaseReceipt.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        platform: true,
        transactionId: true,
        status: true,
        purchasedAt: true,
        expiresAt: true,
        verifiedAt: true,
        refundedAt: true,
        entitlementGrantId: true,
        ledgerEntryId: true,
        product: {
          select: { key: true, name: true, kind: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async verify(
    userId: string,
    sessionId: string | undefined,
    dto: VerifyPurchaseDto
  ) {
    if (!sessionId) throw new UnauthorizedException('Session authentifiée requise.');

    await this.integrity.requireActive(
      userId,
      sessionId,
      dto.attestationId,
      dto.platform
    );

    const product = await this.prisma.storeProduct.findUnique({
      where: { key: dto.productKey }
    });
    if (
      !product ||
      !product.active ||
      product.provider !== dto.provider ||
      product.platform !== dto.platform
    ) {
      throw new NotFoundException('Produit actif introuvable pour cette plateforme.');
    }

    const verified = this.verifyProviderReceipt(dto);
    if (verified.externalProductId !== product.externalProductId) {
      throw new ForbiddenException('Le reçu ne correspond pas au produit demandé.');
    }
    if (verified.status !== 'PURCHASED') {
      throw new ForbiddenException('Le fournisseur n’a pas confirmé cet achat.');
    }

    const receiptHash = this.hash(dto.receipt);

    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.purchaseReceipt.findFirst({
            where: {
              OR: [
                { transactionId: verified.transactionId },
                { receiptHash }
              ]
            },
            include: { product: true }
          });
          if (existing) {
            this.assertReplayOwnership(existing, userId, product.id);
            return { receipt: existing, replayed: true };
          }

          const receipt = await tx.purchaseReceipt.create({
            data: {
              userId,
              productId: product.id,
              provider: dto.provider,
              platform: dto.platform,
              transactionId: verified.transactionId,
              originalTransactionId:
                verified.originalTransactionId?.trim() || null,
              receiptHash,
              status: 'VERIFIED',
              purchasedAt: verified.purchasedAt,
              expiresAt: verified.expiresAt ?? null,
              verifiedAt: new Date(),
              metadata: verified.metadata
            }
          });

          let entitlementGrantId: string | null = null;
          let ledgerEntryId: string | null = null;

          if (product.kind === 'ENTITLEMENT') {
            if (!product.entitlementKey) {
              throw new BadRequestException('Produit sans droit exclusif configuré.');
            }
            const expiresAt =
              verified.expiresAt ??
              (product.durationDays
                ? new Date(
                    verified.purchasedAt.getTime() +
                      product.durationDays * 24 * 60 * 60 * 1000
                  )
                : null);

            const grant = await tx.entitlementGrant.create({
              data: {
                userId,
                key: product.entitlementKey,
                source: 'PURCHASE',
                externalReference: `${dto.provider}:${verified.transactionId}`,
                startsAt: verified.purchasedAt,
                expiresAt,
                reason: `Achat vérifié du produit ${product.key}.`,
                metadata: {
                  purchaseReceiptId: receipt.id,
                  productKey: product.key,
                  provider: dto.provider
                }
              }
            });
            entitlementGrantId = grant.id;
          } else if (product.kind === 'KNOWCOINS') {
            if (!product.coinAmount || product.coinAmount <= 0) {
              throw new BadRequestException('Produit KnowCoins invalide.');
            }
            const mutation = await this.wallet.applyInTransaction(tx, {
              userId,
              amount: product.coinAmount,
              type: 'PURCHASE_CREDIT',
              source: 'STORE_PURCHASE',
              idempotencyKey: `purchase:${dto.provider.toLowerCase()}:${verified.transactionId}`,
              referenceType: 'PurchaseReceipt',
              referenceId: receipt.id,
              reason: `Achat vérifié du produit ${product.key}.`,
              metadata: {
                productKey: product.key,
                provider: dto.provider
              }
            });
            ledgerEntryId = mutation.entry.id;
          } else {
            throw new BadRequestException('Type de produit non pris en charge.');
          }

          const completed = await tx.purchaseReceipt.update({
            where: { id: receipt.id },
            data: { entitlementGrantId, ledgerEntryId },
            include: { product: true }
          });

          return { receipt: completed, replayed: false };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      if (!result.replayed) {
        await this.audit.record({
          actorId: userId,
          action: 'PURCHASE_VERIFIED',
          entity: 'PurchaseReceipt',
          entityId: result.receipt.id,
          targetAccountId: userId,
          metadata: {
            productKey: product.key,
            provider: dto.provider,
            platform: dto.platform,
            transactionId: verified.transactionId,
            kind: product.kind
          }
        });
      }

      return {
        replayed: result.replayed,
        receipt: this.publicReceipt(result.receipt)
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicate = await this.prisma.purchaseReceipt.findFirst({
          where: {
            OR: [
              { transactionId: verified.transactionId },
              { receiptHash }
            ]
          },
          include: { product: true }
        });
        if (duplicate) {
          this.assertReplayOwnership(duplicate, userId, product.id);
          return { replayed: true, receipt: this.publicReceipt(duplicate) };
        }
      }
      throw error;
    }
  }

  async upsertProduct(actorId: string, dto: UpsertStoreProductDto) {
    if (dto.kind === 'ENTITLEMENT' && !dto.entitlementKey) {
      throw new BadRequestException('La clé de droit est obligatoire.');
    }
    if (dto.kind === 'KNOWCOINS' && !dto.coinAmount) {
      throw new BadRequestException('Le montant KnowCoins est obligatoire.');
    }

    const existing = await this.prisma.storeProduct.findUnique({
      where: { key: dto.key }
    });
    if (existing) {
      const receipts = await this.prisma.purchaseReceipt.count({
        where: { productId: existing.id }
      });
      if (
        receipts > 0 &&
        (existing.kind !== dto.kind ||
          existing.externalProductId !== dto.externalProductId ||
          existing.provider !== dto.provider ||
          existing.platform !== dto.platform)
      ) {
        throw new ConflictException(
          'Les identifiants comptables d’un produit déjà vendu sont immuables.'
        );
      }
    }

    const product = await this.prisma.storeProduct.upsert({
      where: { key: dto.key },
      create: {
        key: dto.key,
        provider: dto.provider,
        platform: dto.platform,
        externalProductId: dto.externalProductId,
        name: dto.name,
        description: dto.description?.trim() || null,
        kind: dto.kind,
        entitlementKey: dto.entitlementKey?.trim() || null,
        coinAmount: dto.coinAmount ?? null,
        durationDays: dto.durationDays ?? null,
        active: dto.active ?? false
      },
      update: {
        provider: dto.provider,
        platform: dto.platform,
        externalProductId: dto.externalProductId,
        name: dto.name,
        description: dto.description?.trim() || null,
        kind: dto.kind,
        entitlementKey: dto.entitlementKey?.trim() || null,
        coinAmount: dto.coinAmount ?? null,
        durationDays: dto.durationDays ?? null,
        active: dto.active ?? existing?.active ?? false
      }
    });

    await this.audit.record({
      actorId,
      action: existing ? 'STORE_PRODUCT_UPDATE' : 'STORE_PRODUCT_CREATE',
      entity: 'StoreProduct',
      entityId: product.id,
      metadata: {
        key: product.key,
        provider: product.provider,
        platform: product.platform,
        kind: product.kind,
        active: product.active
      }
    });
    return product;
  }

  listAdminReceipts(userId?: string) {
    return this.prisma.purchaseReceipt.findMany({
      where: userId ? { userId } : undefined,
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
  }

  private verifyProviderReceipt(dto: VerifyPurchaseDto): VerifiedReceipt {
    if (
      this.config.get<string>('NODE_ENV') === 'test' &&
      this.config.get<string>('ALLOW_TEST_PURCHASES') === 'true'
    ) {
      return this.verifySignedTestReceipt(dto.receipt);
    }

    const configured =
      dto.provider === 'GOOGLE'
        ? Boolean(this.config.get<string>('GOOGLE_PLAY_SERVICE_ACCOUNT'))
        : Boolean(this.config.get<string>('APPLE_STORE_SERVER_PRIVATE_KEY'));
    if (!configured) {
      throw new ServiceUnavailableException(
        'Le fournisseur de paiement n’est pas configuré. Achat refusé.'
      );
    }

    throw new ServiceUnavailableException(
      'Le connecteur officiel du fournisseur doit être activé avant la production.'
    );
  }

  private verifySignedTestReceipt(receipt: string): VerifiedReceipt {
    const [prefix, encoded, signature] = receipt.split('.');
    if (prefix !== 'test' || !encoded || !signature) {
      throw new UnauthorizedException('Reçu de test invalide.');
    }

    const secret = this.config.get<string>('TEST_PURCHASE_SECRET');
    if (!secret || secret.length < 24) {
      throw new ServiceUnavailableException('Secret de reçu de test absent.');
    }

    const expected = createHmac('sha256', secret).update(encoded).digest('hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    const provided = Buffer.from(signature, 'hex');
    if (
      expectedBuffer.length !== provided.length ||
      !timingSafeEqual(expectedBuffer, provided)
    ) {
      throw new UnauthorizedException('Signature du reçu invalide.');
    }

    let payload: TestReceiptPayload;
    try {
      payload = JSON.parse(
        Buffer.from(encoded, 'base64url').toString('utf8')
      ) as TestReceiptPayload;
    } catch {
      throw new BadRequestException('Charge utile du reçu invalide.');
    }

    const purchasedAt = new Date(payload.purchasedAt);
    const expiresAt = payload.expiresAt
      ? new Date(payload.expiresAt)
      : undefined;
    if (
      !payload.transactionId ||
      !payload.externalProductId ||
      payload.status !== 'PURCHASED' ||
      Number.isNaN(purchasedAt.getTime()) ||
      purchasedAt > new Date(Date.now() + 5 * 60 * 1000) ||
      (expiresAt && Number.isNaN(expiresAt.getTime()))
    ) {
      throw new UnauthorizedException('Le fournisseur n’a pas confirmé ce reçu.');
    }

    return {
      transactionId: payload.transactionId,
      originalTransactionId: payload.originalTransactionId,
      externalProductId: payload.externalProductId,
      status: 'PURCHASED',
      purchasedAt,
      expiresAt,
      metadata: { test: true }
    };
  }

  private assertReplayOwnership(
    receipt: { userId: string; productId: string },
    userId: string,
    productId: string
  ) {
    if (receipt.userId !== userId || receipt.productId !== productId) {
      throw new ConflictException(
        'Cette transaction appartient à un autre compte ou produit.'
      );
    }
  }

  private publicReceipt(receipt: {
    id: string;
    transactionId: string;
    status: string;
    purchasedAt: Date;
    expiresAt: Date | null;
    entitlementGrantId: string | null;
    ledgerEntryId: string | null;
    product: { key: string; name: string; kind: string };
  }) {
    return {
      id: receipt.id,
      transactionId: receipt.transactionId,
      status: receipt.status,
      purchasedAt: receipt.purchasedAt,
      expiresAt: receipt.expiresAt,
      entitlementGrantId: receipt.entitlementGrantId,
      ledgerEntryId: receipt.ledgerEntryId,
      product: receipt.product
    };
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
