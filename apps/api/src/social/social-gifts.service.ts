import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { staffAccountSelect } from '../staff/staff-profile';
import {
  premiumEntitlementSelect,
  verificationRequestSelect,
  withAccountBadges
} from '../verification/verification-profile';
import { WalletService } from '../wallet/wallet.service';
import { SendSocialGiftDto } from './dto/social-gifts.dto';
import {
  publicSocialGift,
  SOCIAL_GIFT_CATALOG,
  socialGiftByKey,
  SocialGiftDefinition
} from './social-gift.catalog';

const DAILY_GIFT_COUNT_LIMIT = 20;
const DAILY_GIFT_SPEND_LIMIT = 10_000;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,160}$/;
const GIFT_NOTIFICATION_TYPE = 'SOCIAL_GIFT';
const GIFT_LEDGER_TYPE = 'SOCIAL_GIFT_SENT';
const GIFT_LEDGER_SOURCE = 'SOCIAL_GIFT';

type GiftReceiptData = {
  schemaVersion: 1;
  giftId: string;
  giftKey: string;
  giftVersion: number;
  giftName: string;
  giftDescription: string;
  emoji: string;
  rarity: string;
  animationToken: string;
  priceKnowCoins: number;
  senderId: string;
  recipientId: string;
  message: string | null;
  visualOnly: true;
  redeemable: false;
  transferable: false;
  resaleAllowed: false;
  gameplayEffectsAllowed: false;
};

@Injectable()
export class SocialGiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly notifications: NotificationsService
  ) {}

  catalog() {
    return SOCIAL_GIFT_CATALOG.filter((gift) => gift.active).map(publicSocialGift);
  }

  policy() {
    return {
      acceptedFriendsOnly: true,
      recipientBalanceCredited: false,
      visualOnly: true,
      redeemable: false,
      transferable: false,
      resaleAllowed: false,
      gameplayEffectsAllowed: false,
      dailyGiftCountLimit: DAILY_GIFT_COUNT_LIMIT,
      dailySpendLimitKnowCoins: DAILY_GIFT_SPEND_LIMIT,
      pricesAreServerAuthoritative: true,
      idempotencyRequired: true
    } as const;
  }

  async send(
    senderId: string,
    dto: SendSocialGiftDto,
    idempotencyKeyValue: string | undefined
  ) {
    const idempotencyKey = idempotencyKeyValue?.trim() ?? '';
    if (!IDEMPOTENCY_KEY.test(idempotencyKey)) {
      throw new BadRequestException('Clé d’idempotence de cadeau invalide.');
    }

    const recipientId = dto.recipientId.trim();
    if (recipientId === senderId) {
      throw new BadRequestException('Tu ne peux pas t’envoyer un cadeau à toi-même.');
    }

    const gift = socialGiftByKey(dto.giftKey);
    if (!gift) throw new NotFoundException('Cadeau social indisponible.');

    const message = dto.message?.trim() || null;
    const giftId = this.giftId(senderId, idempotencyKey);
    const receipt = this.receipt(giftId, gift, senderId, recipientId, message);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await this.prisma.$transaction(
          async (tx) => {
            const existing = await tx.knowCoinLedgerEntry.findUnique({
              where: { idempotencyKey }
            });
            if (existing) {
              this.assertReplay(existing, receipt, gift.priceKnowCoins);
              const notification = await tx.notification.findUnique({
                where: { id: giftId }
              });
              if (!notification || notification.userId !== recipientId) {
                throw new ConflictException(
                  'Le reçu idempotent de ce cadeau est incomplet.'
                );
              }
              return {
                notification,
                ledgerEntry: existing,
                replayed: true
              };
            }

            await this.assertGiftAllowed(tx, senderId, recipientId, gift.priceKnowCoins);

            const ledger = await this.wallet.applyInTransaction(tx, {
              userId: senderId,
              amount: -gift.priceKnowCoins,
              type: GIFT_LEDGER_TYPE,
              source: GIFT_LEDGER_SOURCE,
              idempotencyKey,
              actorId: senderId,
              reason: `Cadeau social ${gift.key}`,
              referenceType: 'SOCIAL_GIFT',
              referenceId: giftId,
              metadata: receipt as unknown as Prisma.InputJsonValue
            });

            if (ledger.replayed) {
              throw new ConflictException(
                'Cette clé d’idempotence appartient déjà à une autre opération.'
              );
            }

            const notification = await tx.notification.create({
              data: {
                id: giftId,
                userId: recipientId,
                type: GIFT_NOTIFICATION_TYPE,
                title: 'Nouveau cadeau reçu',
                body: `Un ami t’a envoyé ${gift.emoji} ${gift.name}.`,
                data: receipt as unknown as Prisma.InputJsonValue
              }
            });

            return {
              notification,
              ledgerEntry: ledger.entry,
              replayed: false
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );

        if (!result.replayed) {
          this.notifications.publishCreated(result.notification);
        }

        return {
          giftId,
          gift: publicSocialGift(gift),
          recipientId,
          message,
          sentAt: result.notification.createdAt,
          viewedAt: result.notification.readAt,
          senderBalance: result.ledgerEntry.balanceAfter,
          replayed: result.replayed,
          recipientBalanceCredited: false,
          immutableReceipt: true
        };
      } catch (error) {
        if (this.isRetryable(error) && attempt < 2) continue;
        throw error;
      }
    }

    throw new ConflictException('Envoi du cadeau temporairement indisponible.');
  }

  async inbox(userId: string, cursor?: string, limitValue?: string) {
    const limit = this.limit(limitValue);
    const notifications = await this.prisma.notification.findMany({
      where: { userId, type: GIFT_NOTIFICATION_TYPE },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });
    const hasMore = notifications.length > limit;
    const rows = hasMore ? notifications.slice(0, limit) : notifications;
    const parsed = rows
      .map((notification) => ({ notification, receipt: this.parseReceipt(notification.data) }))
      .filter(
        (entry): entry is typeof entry & { receipt: GiftReceiptData } =>
          Boolean(entry.receipt)
      );
    const senders = await this.publicUsers(parsed.map((entry) => entry.receipt.senderId));

    return {
      items: parsed.map(({ notification, receipt }) => ({
        id: notification.id,
        gift: this.publicReceiptGift(receipt),
        sender: senders.get(receipt.senderId) ?? null,
        message: receipt.message,
        sentAt: notification.createdAt,
        viewedAt: notification.readAt,
        visualOnly: true,
        redeemable: false,
        transferable: false
      })),
      nextCursor: hasMore ? rows[rows.length - 1]?.id ?? null : null
    };
  }

  async sent(userId: string, cursor?: string, limitValue?: string) {
    const limit = this.limit(limitValue);
    const entries = await this.prisma.knowCoinLedgerEntry.findMany({
      where: {
        userId,
        type: GIFT_LEDGER_TYPE,
        source: GIFT_LEDGER_SOURCE
      },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });
    const hasMore = entries.length > limit;
    const rows = hasMore ? entries.slice(0, limit) : entries;
    const parsed = rows
      .map((entry) => ({ entry, receipt: this.parseReceipt(entry.metadata) }))
      .filter(
        (item): item is typeof item & { receipt: GiftReceiptData } =>
          Boolean(item.receipt)
      );
    const recipients = await this.publicUsers(
      parsed.map((item) => item.receipt.recipientId)
    );

    return {
      items: parsed.map(({ entry, receipt }) => ({
        id: receipt.giftId,
        ledgerEntryId: entry.id,
        gift: this.publicReceiptGift(receipt),
        recipient: recipients.get(receipt.recipientId) ?? null,
        message: receipt.message,
        priceKnowCoins: Math.abs(entry.amount),
        senderBalanceAfter: entry.balanceAfter,
        sentAt: entry.createdAt,
        visualOnly: true,
        redeemable: false,
        transferable: false
      })),
      nextCursor: hasMore ? rows[rows.length - 1]?.id ?? null : null
    };
  }

  async markViewed(userId: string, giftId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: giftId,
        userId,
        type: GIFT_NOTIFICATION_TYPE
      },
      select: { id: true }
    });
    if (!notification) throw new NotFoundException('Cadeau reçu introuvable.');
    const updated = await this.notifications.markRead(userId, giftId);
    return { id: updated.id, viewedAt: updated.readAt };
  }

  async deleteForAccount(userId: string, tx: Prisma.TransactionClient) {
    await tx.notification.deleteMany({
      where: {
        type: GIFT_NOTIFICATION_TYPE,
        OR: [
          { userId },
          {
            data: {
              path: ['senderId'],
              equals: userId
            }
          }
        ]
      }
    });
  }

  private async assertGiftAllowed(
    tx: Prisma.TransactionClient,
    senderId: string,
    recipientId: string,
    priceKnowCoins: number
  ) {
    const [recipient, friendship] = await Promise.all([
      tx.user.findUnique({
        where: { id: recipientId },
        select: { id: true, isSuspended: true }
      }),
      tx.friendship.findFirst({
        where: {
          OR: [
            { requesterId: senderId, addresseeId: recipientId },
            { requesterId: recipientId, addresseeId: senderId }
          ]
        },
        select: { status: true }
      })
    ]);

    if (!recipient || recipient.isSuspended) {
      throw new NotFoundException('Destinataire indisponible.');
    }
    if (friendship?.status !== 'ACCEPTED') {
      throw new BadRequestException(
        'Les cadeaux sociaux sont réservés aux amitiés acceptées.'
      );
    }

    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const [count, aggregate] = await Promise.all([
      tx.knowCoinLedgerEntry.count({
        where: {
          userId: senderId,
          type: GIFT_LEDGER_TYPE,
          source: GIFT_LEDGER_SOURCE,
          createdAt: { gte: dayStart }
        }
      }),
      tx.knowCoinLedgerEntry.aggregate({
        where: {
          userId: senderId,
          type: GIFT_LEDGER_TYPE,
          source: GIFT_LEDGER_SOURCE,
          createdAt: { gte: dayStart }
        },
        _sum: { amount: true }
      })
    ]);

    if (count >= DAILY_GIFT_COUNT_LIMIT) {
      throw new BadRequestException(
        'La limite quotidienne de cadeaux sociaux est atteinte.'
      );
    }
    const alreadySpent = Math.abs(aggregate._sum.amount ?? 0);
    if (alreadySpent + priceKnowCoins > DAILY_GIFT_SPEND_LIMIT) {
      throw new BadRequestException(
        'La limite quotidienne de dépenses en cadeaux est atteinte.'
      );
    }
  }

  private receipt(
    giftId: string,
    gift: SocialGiftDefinition,
    senderId: string,
    recipientId: string,
    message: string | null
  ): GiftReceiptData {
    return {
      schemaVersion: 1,
      giftId,
      giftKey: gift.key,
      giftVersion: gift.version,
      giftName: gift.name,
      giftDescription: gift.description,
      emoji: gift.emoji,
      rarity: gift.rarity,
      animationToken: gift.animationToken,
      priceKnowCoins: gift.priceKnowCoins,
      senderId,
      recipientId,
      message,
      visualOnly: true,
      redeemable: false,
      transferable: false,
      resaleAllowed: false,
      gameplayEffectsAllowed: false
    };
  }

  private publicReceiptGift(receipt: GiftReceiptData) {
    return {
      key: receipt.giftKey,
      version: receipt.giftVersion,
      name: receipt.giftName,
      description: receipt.giftDescription,
      emoji: receipt.emoji,
      rarity: receipt.rarity,
      animationToken: receipt.animationToken,
      priceKnowCoins: receipt.priceKnowCoins,
      visualOnly: true,
      redeemable: false,
      transferable: false,
      resaleAllowed: false,
      gameplayEffectsAllowed: false
    } as const;
  }

  private parseReceipt(value: Prisma.JsonValue | null): GiftReceiptData | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const data = value as Prisma.JsonObject;
    if (
      data.schemaVersion !== 1 ||
      typeof data.giftId !== 'string' ||
      typeof data.giftKey !== 'string' ||
      typeof data.giftVersion !== 'number' ||
      typeof data.giftName !== 'string' ||
      typeof data.giftDescription !== 'string' ||
      typeof data.emoji !== 'string' ||
      typeof data.rarity !== 'string' ||
      typeof data.animationToken !== 'string' ||
      typeof data.priceKnowCoins !== 'number' ||
      typeof data.senderId !== 'string' ||
      typeof data.recipientId !== 'string'
    ) {
      return null;
    }
    return data as unknown as GiftReceiptData;
  }

  private assertReplay(
    entry: {
      userId: string;
      amount: number;
      type: string;
      source: string;
      referenceType: string | null;
      referenceId: string | null;
      metadata: Prisma.JsonValue | null;
    },
    expected: GiftReceiptData,
    priceKnowCoins: number
  ) {
    const stored = this.parseReceipt(entry.metadata);
    if (
      entry.userId !== expected.senderId ||
      entry.amount !== -priceKnowCoins ||
      entry.type !== GIFT_LEDGER_TYPE ||
      entry.source !== GIFT_LEDGER_SOURCE ||
      entry.referenceType !== 'SOCIAL_GIFT' ||
      entry.referenceId !== expected.giftId ||
      !stored ||
      stored.giftKey !== expected.giftKey ||
      stored.recipientId !== expected.recipientId ||
      stored.message !== expected.message
    ) {
      throw new ConflictException(
        'Cette clé d’idempotence appartient à une autre opération.'
      );
    }
  }

  private async publicUsers(userIds: string[]) {
    const ids = [...new Set(userIds)].filter(Boolean);
    if (ids.length === 0) return new Map<string, unknown>();
    const now = new Date();
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids }, isSuspended: false },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        staffAccount: { select: staffAccountSelect },
        verificationRequests: verificationRequestSelect,
        entitlementGrants: premiumEntitlementSelect(now)
      }
    });
    return new Map(
      users.map((user) => [user.id, withAccountBadges(user, now)] as const)
    );
  }

  private giftId(senderId: string, idempotencyKey: string) {
    const digest = createHash('sha256')
      .update(`knowme-social-gift:${senderId}:${idempotencyKey}`)
      .digest('hex');
    return `sg_${digest.slice(0, 28)}`;
  }

  private limit(value?: string) {
    const parsed = Number(value ?? 20);
    return Number.isSafeInteger(parsed) ? Math.min(Math.max(parsed, 1), 50) : 20;
  }

  private isRetryable(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2034'].includes(error.code)
    );
  }
}
