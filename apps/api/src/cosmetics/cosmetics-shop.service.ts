import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import {
  CreateCosmeticOfferDto,
  PurchaseCosmeticOfferDto
} from './dto/cosmetics-shop.dto';

type AvailableDefinition = {
  active: boolean;
  startsAt: Date;
  endsAt: Date | null;
};

@Injectable()
export class CosmeticsShopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly audit: AuditService
  ) {}

  policy() {
    return {
      currency: 'KNOWCOINS',
      verifiedLedgerRequired: true,
      atomicDebitAndOwnership: true,
      idempotentPurchases: true,
      onePurchasePerItemPerAccount: true,
      visualOnly: true,
      gameplayEffectsAllowed: false,
      paidPriorityAllowed: false,
      socialVisibilityBoostAllowed: false,
      premiumBypassAllowed: false
    };
  }

  isAvailable(definition: AvailableDefinition, now = new Date()) {
    return (
      definition.active &&
      definition.startsAt <= now &&
      (!definition.endsAt || definition.endsAt > now)
    );
  }

  async shop(userId: string, now = new Date()) {
    const [offers, ownerships, wallet] = await Promise.all([
      this.prisma.cosmeticOfferDefinition.findMany({
        where: {
          active: true,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
          item: {
            active: true,
            startsAt: { lte: now },
            OR: [{ endsAt: null }, { endsAt: { gt: now } }]
          }
        },
        include: { item: true },
        orderBy: [{ key: 'asc' }, { version: 'desc' }]
      }),
      this.prisma.cosmeticOwnership.findMany({
        where: { userId, revokedAt: null },
        select: { itemId: true }
      }),
      this.wallet.me(userId)
    ]);

    const latestByKey = new Map<string, (typeof offers)[number]>();
    for (const offer of offers) {
      if (!latestByKey.has(offer.key)) latestByKey.set(offer.key, offer);
    }
    const ownedItemIds = new Set(ownerships.map((ownership) => ownership.itemId));

    return {
      offers: Array.from(latestByKey.values()).map((offer) => ({
        ...offer,
        owned: ownedItemIds.has(offer.itemId),
        affordable: wallet.balance >= offer.priceKnowCoins
      })),
      wallet,
      rules: this.policy(),
      serverTime: now
    };
  }

  async history(userId: string) {
    const receipts = await this.prisma.cosmeticPurchaseReceipt.findMany({
      where: { userId },
      include: { offer: true, item: true },
      orderBy: [{ purchasedAt: 'desc' }, { id: 'desc' }]
    });
    return { receipts, rules: this.policy() };
  }

  async createOffer(actorId: string, dto: CreateCosmeticOfferDto) {
    if (!Number.isSafeInteger(dto.priceKnowCoins) || dto.priceKnowCoins > 1_000_000) {
      throw new BadRequestException('Prix KnowCoins invalide.');
    }
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date();
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (endsAt && endsAt <= startsAt) {
      throw new BadRequestException('La fin de l’offre doit suivre son début.');
    }

    const item = await this.prisma.cosmeticItemDefinition.findUnique({
      where: { id: dto.itemId }
    });
    if (!item) throw new NotFoundException('Objet cosmétique introuvable.');
    if (dto.active && !this.isAvailable(item)) {
      throw new BadRequestException(
        'Une offre active exige un objet cosmétique actuellement disponible.'
      );
    }

    try {
      const offer = await this.prisma.cosmeticOfferDefinition.create({
        data: {
          key: dto.key,
          version: dto.version,
          itemId: dto.itemId,
          priceKnowCoins: dto.priceKnowCoins,
          active: dto.active ?? false,
          startsAt,
          endsAt,
          createdById: actorId,
          reason: dto.reason
        },
        include: { item: true }
      });

      await this.audit.record({
        actorId,
        action: 'COSMETIC_OFFER_PUBLISHED',
        entity: 'CosmeticOfferDefinition',
        entityId: offer.id,
        metadata: {
          key: offer.key,
          version: offer.version,
          itemId: offer.itemId,
          priceKnowCoins: offer.priceKnowCoins,
          active: offer.active,
          visualOnly: true
        }
      });
      return offer;
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        throw new ConflictException('Cette version d’offre cosmétique existe déjà.');
      }
      throw error;
    }
  }

  async purchase(userId: string, dto: PurchaseCosmeticOfferDto) {
    const idempotencyKey = `cosmetic-purchase:${userId}:${dto.clientPurchaseId}`;
    const ledgerIdempotencyKey = `cosmetic-ledger:${userId}:${dto.clientPurchaseId}`;
    const replay = await this.prisma.cosmeticPurchaseReceipt.findUnique({
      where: { idempotencyKey },
      include: { offer: true, item: true }
    });
    if (replay) {
      this.assertReplayMatches(replay.userId, replay.offerId, userId, dto.offerId);
      return {
        receipt: replay,
        ownership: await this.prisma.cosmeticOwnership.findUnique({
          where: { userId_itemId: { userId, itemId: replay.itemId } }
        }),
        ledgerEntry: await this.prisma.knowCoinLedgerEntry.findUnique({
          where: { id: replay.ledgerEntryId }
        }),
        replayed: true,
        rules: this.policy()
      };
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await this.prisma.$transaction(
          async (tx) => {
            const duplicate = await tx.cosmeticPurchaseReceipt.findUnique({
              where: { idempotencyKey },
              include: { offer: true, item: true }
            });
            if (duplicate) {
              this.assertReplayMatches(
                duplicate.userId,
                duplicate.offerId,
                userId,
                dto.offerId
              );
              return {
                receipt: duplicate,
                ownership: await tx.cosmeticOwnership.findUnique({
                  where: { userId_itemId: { userId, itemId: duplicate.itemId } }
                }),
                ledgerEntry: await tx.knowCoinLedgerEntry.findUnique({
                  where: { id: duplicate.ledgerEntryId }
                }),
                replayed: true
              };
            }

            const offer = await tx.cosmeticOfferDefinition.findUnique({
              where: { id: dto.offerId },
              include: { item: true }
            });
            if (!offer) throw new NotFoundException('Offre cosmétique introuvable.');
            const now = new Date();
            if (!this.isAvailable(offer, now) || !this.isAvailable(offer.item, now)) {
              throw new BadRequestException('Cette offre cosmétique n’est plus disponible.');
            }

            const currentOwnership = await tx.cosmeticOwnership.findUnique({
              where: { userId_itemId: { userId, itemId: offer.itemId } }
            });
            if (currentOwnership && !currentOwnership.revokedAt) {
              throw new ConflictException('Cet objet cosmétique est déjà possédé.');
            }

            const walletMutation = await this.wallet.applyInTransaction(tx, {
              userId,
              amount: -offer.priceKnowCoins,
              type: 'COSMETIC_PURCHASE',
              source: 'COSMETICS_SHOP',
              idempotencyKey: ledgerIdempotencyKey,
              actorId: userId,
              reason: `Achat de ${offer.item.name}`,
              referenceType: 'CosmeticOfferDefinition',
              referenceId: offer.id,
              metadata: {
                offerKey: offer.key,
                offerVersion: offer.version,
                itemId: offer.itemId,
                visualOnly: true
              }
            });

            const ownership = currentOwnership
              ? await tx.cosmeticOwnership.update({
                  where: { id: currentOwnership.id },
                  data: {
                    source: 'PURCHASE',
                    externalReference: idempotencyKey,
                    grantedById: null,
                    reason: 'Acquisition via la boutique cosmétique KnowCoins.',
                    acquiredAt: now,
                    revokedAt: null,
                    revokedById: null
                  }
                })
              : await tx.cosmeticOwnership.create({
                  data: {
                    userId,
                    itemId: offer.itemId,
                    source: 'PURCHASE',
                    externalReference: idempotencyKey,
                    grantedById: null,
                    reason: 'Acquisition via la boutique cosmétique KnowCoins.'
                  }
                });

            const receipt = await tx.cosmeticPurchaseReceipt.create({
              data: {
                userId,
                offerId: offer.id,
                itemId: offer.itemId,
                priceKnowCoins: offer.priceKnowCoins,
                idempotencyKey,
                ledgerEntryId: walletMutation.entry.id
              },
              include: { offer: true, item: true }
            });

            return {
              receipt,
              ownership,
              ledgerEntry: walletMutation.entry,
              replayed: false
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );

        if (!result.replayed) {
          await this.audit.record({
            actorId: userId,
            action: 'COSMETIC_PURCHASE_COMPLETED',
            entity: 'CosmeticPurchaseReceipt',
            entityId: result.receipt.id,
            targetAccountId: userId,
            metadata: {
              offerId: result.receipt.offerId,
              itemId: result.receipt.itemId,
              priceKnowCoins: result.receipt.priceKnowCoins,
              ledgerEntryId: result.receipt.ledgerEntryId,
              idempotencyKey,
              visualOnly: true
            }
          });
        }

        return { ...result, rules: this.policy() };
      } catch (error) {
        if (this.isRetryableTransaction(error) && attempt < 2) continue;
        if (this.isUniqueConflict(error)) {
          const duplicate = await this.prisma.cosmeticPurchaseReceipt.findUnique({
            where: { idempotencyKey },
            include: { offer: true, item: true }
          });
          if (duplicate) {
            this.assertReplayMatches(
              duplicate.userId,
              duplicate.offerId,
              userId,
              dto.offerId
            );
            return {
              receipt: duplicate,
              ownership: await this.prisma.cosmeticOwnership.findUnique({
                where: { userId_itemId: { userId, itemId: duplicate.itemId } }
              }),
              ledgerEntry: await this.prisma.knowCoinLedgerEntry.findUnique({
                where: { id: duplicate.ledgerEntryId }
              }),
              replayed: true,
              rules: this.policy()
            };
          }
          throw new ConflictException('Cet objet cosmétique est déjà possédé.');
        }
        throw error;
      }
    }

    throw new BadRequestException('Achat cosmétique temporairement indisponible.');
  }

  private assertReplayMatches(
    storedUserId: string,
    storedOfferId: string,
    userId: string,
    offerId: string
  ) {
    if (storedUserId !== userId || storedOfferId !== offerId) {
      throw new BadRequestException(
        'Cette clé d’achat appartient à une autre opération cosmétique.'
      );
    }
  }

  private isRetryableTransaction(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
  }

  private isUniqueConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
