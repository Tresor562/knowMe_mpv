import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

const DAILY_QUEST_KEY = 'daily_challenge_explorer';
const DAILY_CHEST_AMOUNT = 10;
const SERIALIZABLE_ATTEMPTS = 3;

@Injectable()
export class DailyChestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService
  ) {}

  async today(userId: string, now = new Date()) {
    const claimDate = this.chestDay(now);
    const [quest, claim, wallet] = await Promise.all([
      this.prisma.dailyQuestProgress.findUnique({
        where: {
          userId_questKey_questDate: {
            userId,
            questKey: DAILY_QUEST_KEY,
            questDate: claimDate
          }
        }
      }),
      this.prisma.dailyChestClaim.findUnique({
        where: { userId_claimDate: { userId, claimDate } }
      }),
      this.wallet.me(userId)
    ]);

    return this.state(claimDate, quest, claim, wallet.balance);
  }

  async claim(userId: string, now = new Date()) {
    const claimDate = this.chestDay(now);
    const existing = await this.prisma.dailyChestClaim.findUnique({
      where: { userId_claimDate: { userId, claimDate } }
    });
    if (existing) {
      return {
        replayed: true,
        claim: existing,
        state: await this.today(userId, now)
      };
    }

    const dateKey = claimDate.toISOString().slice(0, 10);
    const idempotencyKey = `daily-chest:${userId}:${dateKey}`;

    for (let attempt = 0; attempt < SERIALIZABLE_ATTEMPTS; attempt += 1) {
      try {
        const result = await this.prisma.$transaction(
          async (tx) => {
            const duplicate = await tx.dailyChestClaim.findUnique({
              where: { userId_claimDate: { userId, claimDate } }
            });
            if (duplicate) return { replayed: true, claim: duplicate };

            const quest = await tx.dailyQuestProgress.findUnique({
              where: {
                userId_questKey_questDate: {
                  userId,
                  questKey: DAILY_QUEST_KEY,
                  questDate: claimDate
                }
              }
            });
            if (!quest || quest.status !== 'COMPLETED') {
              throw new BadRequestException(
                'Termine la quête quotidienne avant d’ouvrir le coffre.'
              );
            }

            const ledger = await this.wallet.applyInTransaction(tx, {
              userId,
              amount: DAILY_CHEST_AMOUNT,
              type: 'DAILY_CHEST_CREDIT',
              source: 'DAILY_CHEST',
              idempotencyKey,
              reason: 'Coffre quotidien déterministe après quête complétée.',
              referenceType: 'DAILY_QUEST_PROGRESS',
              referenceId: quest.id,
              metadata: {
                claimDate: claimDate.toISOString(),
                questKey: DAILY_QUEST_KEY,
                random: false
              }
            });
            const claim = await tx.dailyChestClaim.create({
              data: {
                userId,
                claimDate,
                questProgressId: quest.id,
                amount: DAILY_CHEST_AMOUNT,
                idempotencyKey,
                ledgerEntryId: ledger.entry.id
              }
            });
            await tx.auditLog.create({
              data: {
                actorId: userId,
                action: 'DAILY_CHEST_CLAIM',
                entity: 'DailyChestClaim',
                entityId: claim.id,
                targetAccountId: userId,
                metadata: {
                  claimDate: claimDate.toISOString(),
                  amount: DAILY_CHEST_AMOUNT,
                  ledgerEntryId: ledger.entry.id,
                  random: false
                }
              }
            });

            return { replayed: ledger.replayed, claim };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );

        return {
          ...result,
          state: await this.today(userId, now)
        };
      } catch (error) {
        if (this.isUniqueConflict(error)) {
          const duplicate = await this.prisma.dailyChestClaim.findUnique({
            where: { userId_claimDate: { userId, claimDate } }
          });
          if (duplicate) {
            return {
              replayed: true,
              claim: duplicate,
              state: await this.today(userId, now)
            };
          }
        }
        if (
          (this.isUniqueConflict(error) || this.isRetryableTransaction(error)) &&
          attempt < SERIALIZABLE_ATTEMPTS - 1
        ) {
          await this.transactionBackoff(attempt);
          continue;
        }
        throw error;
      }
    }

    throw new BadRequestException('Coffre temporairement indisponible.');
  }

  async exportForAccount(userId: string) {
    return this.prisma.dailyChestClaim.findMany({
      where: { userId },
      orderBy: [{ claimDate: 'desc' }, { id: 'desc' }]
    });
  }

  async deleteForAccount(userId: string, tx: Prisma.TransactionClient) {
    await tx.dailyChestClaim.deleteMany({ where: { userId } });
  }

  chestDay(value: Date) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
    );
  }

  private state(
    claimDate: Date,
    quest: { id: string; status: string; completedAt: Date | null } | null,
    claim: {
      id: string;
      amount: number;
      claimedAt: Date;
      ledgerEntryId: string;
    } | null,
    currentBalance: number
  ) {
    const eligible = quest?.status === 'COMPLETED';
    return {
      claimDate,
      expiresAt: new Date(claimDate.getTime() + 24 * 60 * 60 * 1000),
      eligible,
      claimed: Boolean(claim),
      canClaim: eligible && !claim,
      quest: quest
        ? {
            id: quest.id,
            status: quest.status,
            completedAt: quest.completedAt
          }
        : null,
      claim,
      currentBalance,
      rules: {
        amount: DAILY_CHEST_AMOUNT,
        currency: 'KNOWCOIN',
        deterministic: true,
        randomReward: false,
        purchaseRequired: false,
        premiumBoostAllowed: false,
        streakPenalty: false,
        eligibleQuestKey: DAILY_QUEST_KEY,
        oneClaimPerUtcDay: true
      }
    };
  }

  private isUniqueConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private isRetryableTransaction(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
  }

  private async transactionBackoff(attempt: number) {
    await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
  }
}
