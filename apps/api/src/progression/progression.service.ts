import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ChallengeCompletionProgressionInput = {
  participantId: string;
  userId: string;
  creatorId: string;
  challengeId: string;
  questionCount: number;
  completedAt: Date;
};

type AwardInput = {
  userId: string;
  amount: number;
  source: string;
  reason: string;
  idempotencyKey: string;
  referenceType?: string;
  referenceId?: string;
  metadata?: Prisma.InputJsonValue;
};

const CHALLENGE_COMPLETION_XP = 50;
const MINIMUM_CHALLENGE_QUESTIONS = 3;
const LEVEL_BASE_XP = 100;

@Injectable()
export class ProgressionService {
  constructor(private readonly prisma: PrismaService) {}

  async processChallengeCompletion(input: ChallengeCompletionProgressionInput) {
    if (input.userId === input.creatorId) {
      return this.ignored(
        input.userId,
        'SELF_CHALLENGE',
        'Le créateur ne gagne pas d’XP sur son propre défi.'
      );
    }
    if (input.questionCount < MINIMUM_CHALLENGE_QUESTIONS) {
      return this.ignored(
        input.userId,
        'MIN_QUESTIONS',
        `Le défi doit contenir au moins ${MINIMUM_CHALLENGE_QUESTIONS} questions pour attribuer de l’XP.`
      );
    }

    return this.award({
      userId: input.userId,
      amount: CHALLENGE_COMPLETION_XP,
      source: 'CHALLENGE_COMPLETION',
      reason: 'Première complétion éligible d’un défi KnowMe.',
      idempotencyKey: `xp:challenge-completion:${input.participantId}`,
      referenceType: 'CHALLENGE_PARTICIPANT',
      referenceId: input.participantId,
      metadata: {
        challengeId: input.challengeId,
        participantId: input.participantId,
        questionCount: input.questionCount,
        completedAt: input.completedAt.toISOString()
      }
    });
  }

  async summary(userId: string, cursor?: string, limit = 30) {
    const safeLimit = Math.min(Math.max(Number.isFinite(limit) ? limit : 30, 1), 100);
    const [profile, entries] = await Promise.all([
      this.rebuildProjection(userId),
      this.prisma.xpLedgerEntry.findMany({
        where: { userId },
        take: safeLimit + 1,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
      })
    ]);
    const hasMore = entries.length > safeLimit;
    const items = hasMore ? entries.slice(0, safeLimit) : entries;

    return {
      profile: this.publicProfile(profile.totalXp, profile.level, profile.updatedAt),
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
      rules: {
        challengeCompletionXp: CHALLENGE_COMPLETION_XP,
        minimumChallengeQuestions: MINIMUM_CHALLENGE_QUESTIONS,
        levelFormula: '100 × (niveau − 1)²'
      }
    };
  }

  async exportForAccount(userId: string) {
    const [profile, ledger] = await Promise.all([
      this.rebuildProjection(userId),
      this.prisma.xpLedgerEntry.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
      })
    ]);
    return {
      profile: this.publicProfile(profile.totalXp, profile.level, profile.updatedAt),
      ledger
    };
  }

  async deleteForAccount(userId: string, tx: Prisma.TransactionClient) {
    await tx.xpLedgerEntry.deleteMany({ where: { userId } });
    await tx.userProgression.deleteMany({ where: { userId } });
  }

  describeProgress(totalXp: number) {
    const safeTotalXp = Math.max(0, Math.floor(totalXp));
    const level = Math.floor(Math.sqrt(safeTotalXp / LEVEL_BASE_XP)) + 1;
    const currentLevelStartXp = this.thresholdForLevel(level);
    const nextLevelXp = this.thresholdForLevel(level + 1);
    const xpIntoLevel = safeTotalXp - currentLevelStartXp;
    const levelSpan = nextLevelXp - currentLevelStartXp;

    return {
      totalXp: safeTotalXp,
      level,
      currentLevelStartXp,
      nextLevelXp,
      xpIntoLevel,
      xpToNextLevel: nextLevelXp - safeTotalXp,
      progressPercent: levelSpan > 0
        ? Math.min(100, Math.floor((xpIntoLevel / levelSpan) * 100))
        : 100
    };
  }

  private async award(input: AwardInput) {
    const existing = await this.prisma.xpLedgerEntry.findUnique({
      where: { idempotencyKey: input.idempotencyKey }
    });
    if (existing) return this.replay(existing);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const duplicate = await tx.xpLedgerEntry.findUnique({
              where: { idempotencyKey: input.idempotencyKey }
            });
            if (duplicate) {
              const projection = await this.projectionFromTransaction(
                tx,
                input.userId
              );
              return this.awardedResponse(
                duplicate,
                projection.totalXp,
                projection.level,
                projection.updatedAt,
                true,
                false
              );
            }

            const entry = await tx.xpLedgerEntry.create({
              data: {
                userId: input.userId,
                amount: input.amount,
                source: input.source,
                reason: input.reason,
                idempotencyKey: input.idempotencyKey,
                referenceType: input.referenceType,
                referenceId: input.referenceId,
                metadata: input.metadata
              }
            });
            const projection = await this.projectionFromTransaction(
              tx,
              input.userId
            );
            const previousLevel = this.describeProgress(
              projection.totalXp - input.amount
            ).level;

            return this.awardedResponse(
              entry,
              projection.totalXp,
              projection.level,
              projection.updatedAt,
              false,
              projection.level > previousLevel
            );
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
      } catch (error) {
        if (this.isUniqueConflict(error)) {
          const duplicate = await this.prisma.xpLedgerEntry.findUnique({
            where: { idempotencyKey: input.idempotencyKey }
          });
          if (duplicate) return this.replay(duplicate);
        }
        if (this.isRetryableTransaction(error) && attempt < 2) continue;
        throw error;
      }
    }

    throw new BadRequestException('Progression temporairement indisponible.');
  }

  private async ignored(userId: string, reasonCode: string, explanation: string) {
    const projection = await this.rebuildProjection(userId);
    return {
      awarded: false,
      replayed: false,
      amount: 0,
      reasonCode,
      explanation,
      levelUp: false,
      entry: null,
      profile: this.publicProfile(
        projection.totalXp,
        projection.level,
        projection.updatedAt
      )
    };
  }

  private async replay(entry: {
    id: string;
    userId: string;
    amount: number;
    source: string;
    reason: string;
    idempotencyKey: string;
    referenceType: string | null;
    referenceId: string | null;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
  }) {
    const projection = await this.rebuildProjection(entry.userId);
    return this.awardedResponse(
      entry,
      projection.totalXp,
      projection.level,
      projection.updatedAt,
      true,
      false
    );
  }

  private awardedResponse(
    entry: {
      id: string;
      userId: string;
      amount: number;
      source: string;
      reason: string;
      idempotencyKey: string;
      referenceType: string | null;
      referenceId: string | null;
      metadata: Prisma.JsonValue | null;
      createdAt: Date;
    },
    totalXp: number,
    level: number,
    updatedAt: Date,
    replayed: boolean,
    levelUp: boolean
  ) {
    return {
      awarded: true,
      replayed,
      amount: entry.amount,
      reasonCode: 'ELIGIBLE',
      explanation: `${entry.amount} XP attribués.`,
      levelUp,
      entry,
      profile: this.publicProfile(totalXp, level, updatedAt)
    };
  }

  private async rebuildProjection(userId: string) {
    return this.prisma.$transaction(
      (tx) => this.projectionFromTransaction(tx, userId),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  private async projectionFromTransaction(
    tx: Prisma.TransactionClient,
    userId: string
  ) {
    const aggregate = await tx.xpLedgerEntry.aggregate({
      where: { userId },
      _sum: { amount: true }
    });
    const totalXp = aggregate._sum.amount ?? 0;
    const level = this.describeProgress(totalXp).level;
    return tx.userProgression.upsert({
      where: { userId },
      create: { userId, totalXp, level },
      update: { totalXp, level }
    });
  }

  private publicProfile(totalXp: number, level: number, updatedAt: Date) {
    return {
      ...this.describeProgress(totalXp),
      level,
      updatedAt
    };
  }

  private thresholdForLevel(level: number) {
    const normalizedLevel = Math.max(1, Math.floor(level));
    return LEVEL_BASE_XP * (normalizedLevel - 1) ** 2;
  }

  private isRetryableTransaction(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
  }

  private isUniqueConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
