import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustKnowCoinsDto } from './dto/wallet.dto';

type LedgerMutation = {
  userId: string;
  amount: number;
  type: string;
  source: string;
  idempotencyKey: string;
  actorId?: string;
  reason?: string;
  referenceType?: string;
  referenceId?: string;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async me(userId: string) {
    const wallet = await this.ensureWallet(userId);
    return {
      accountId: userId,
      balance: wallet.balance,
      version: wallet.version,
      updatedAt: wallet.updatedAt,
      serverTime: new Date()
    };
  }

  async history(userId: string, cursor?: string, limit = 30) {
    await this.ensureWallet(userId);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const entries = await this.prisma.knowCoinLedgerEntry.findMany({
      where: { userId },
      take: safeLimit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });

    const hasMore = entries.length > safeLimit;
    const items = hasMore ? entries.slice(0, safeLimit) : entries;
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null
    };
  }

  async adminWallet(userId: string) {
    const wallet = await this.ensureWallet(userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, displayName: true, email: true }
    });
    if (!user) throw new NotFoundException('Compte utilisateur introuvable.');
    return { ...wallet, user };
  }

  async adjust(actorId: string, dto: AdjustKnowCoinsDto) {
    const result = await this.mutate({
      userId: dto.userId,
      amount: dto.amount,
      type: dto.amount > 0 ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT',
      source: 'ADMIN',
      idempotencyKey: dto.idempotencyKey,
      actorId,
      reason: dto.reason.trim(),
      referenceType: dto.referenceType?.trim(),
      referenceId: dto.referenceId?.trim()
    });

    if (!result.replayed) {
      await this.audit.record({
        actorId,
        action: 'KNOWCOIN_ADMIN_ADJUSTMENT',
        entity: 'KnowCoinLedgerEntry',
        entityId: result.entry.id,
        targetAccountId: dto.userId,
        metadata: {
          amount: dto.amount,
          balanceBefore: result.entry.balanceBefore,
          balanceAfter: result.entry.balanceAfter,
          idempotencyKey: dto.idempotencyKey,
          reason: dto.reason.trim()
        }
      });
    }

    return result;
  }

  credit(input: Omit<LedgerMutation, 'amount'> & { amount: number }) {
    if (input.amount <= 0) {
      throw new BadRequestException('Un crédit doit être strictement positif.');
    }
    return this.mutate(input);
  }

  debit(input: Omit<LedgerMutation, 'amount'> & { amount: number }) {
    if (input.amount >= 0) {
      throw new BadRequestException('Un débit doit être strictement négatif.');
    }
    return this.mutate(input);
  }

  private async ensureWallet(userId: string) {
    const existing = await this.prisma.knowCoinWallet.findUnique({
      where: { userId }
    });
    if (existing) return existing;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, knowCoins: true }
    });
    if (!user) throw new NotFoundException('Compte utilisateur introuvable.');

    return this.prisma.knowCoinWallet.upsert({
      where: { userId },
      create: { userId, balance: user.knowCoins },
      update: {}
    });
  }

  private async mutate(input: LedgerMutation) {
    if (!Number.isSafeInteger(input.amount) || input.amount === 0) {
      throw new BadRequestException('Montant KnowCoins invalide.');
    }
    if (Math.abs(input.amount) > 1_000_000) {
      throw new BadRequestException('Montant KnowCoins trop élevé.');
    }

    const replay = await this.prisma.knowCoinLedgerEntry.findUnique({
      where: { idempotencyKey: input.idempotencyKey }
    });
    if (replay) {
      if (replay.userId !== input.userId || replay.amount !== input.amount) {
        throw new BadRequestException(
          'Cette clé d’idempotence appartient à une autre opération.'
        );
      }
      return { entry: replay, replayed: true };
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const entry = await this.prisma.$transaction(
          async (tx) => {
            const duplicate = await tx.knowCoinLedgerEntry.findUnique({
              where: { idempotencyKey: input.idempotencyKey }
            });
            if (duplicate) return duplicate;

            const user = await tx.user.findUnique({
              where: { id: input.userId },
              select: { id: true, knowCoins: true }
            });
            if (!user) throw new NotFoundException('Compte utilisateur introuvable.');

            const wallet = await tx.knowCoinWallet.upsert({
              where: { userId: input.userId },
              create: { userId: input.userId, balance: user.knowCoins },
              update: {}
            });
            const balanceAfter = wallet.balance + input.amount;
            if (!Number.isSafeInteger(balanceAfter) || balanceAfter < 0) {
              throw new BadRequestException('Solde KnowCoins insuffisant.');
            }

            await tx.knowCoinWallet.update({
              where: { userId: input.userId },
              data: {
                balance: balanceAfter,
                version: { increment: 1 }
              }
            });
            await tx.user.update({
              where: { id: input.userId },
              data: { knowCoins: balanceAfter }
            });

            return tx.knowCoinLedgerEntry.create({
              data: {
                userId: input.userId,
                amount: input.amount,
                balanceBefore: wallet.balance,
                balanceAfter,
                type: input.type,
                source: input.source,
                idempotencyKey: input.idempotencyKey,
                referenceType: input.referenceType?.trim() || null,
                referenceId: input.referenceId?.trim() || null,
                actorId: input.actorId ?? null,
                reason: input.reason?.trim() || null,
                metadata: input.metadata
              }
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );

        return { entry, replayed: false };
      } catch (error) {
        if (this.isUniqueConflict(error)) {
          const duplicate = await this.prisma.knowCoinLedgerEntry.findUnique({
            where: { idempotencyKey: input.idempotencyKey }
          });
          if (duplicate) return { entry: duplicate, replayed: true };
        }
        if (this.isRetryableTransaction(error) && attempt < 2) continue;
        throw error;
      }
    }

    throw new BadRequestException('Opération KnowCoins temporairement indisponible.');
  }

  private isRetryableTransaction(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
  }

  private isUniqueConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
