import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ChallengeStreakInput = {
  participantId: string;
  userId: string;
  creatorId: string;
  challengeId: string;
  questionCount: number;
  completedAt: Date;
};

type ActivityInput = {
  userId: string;
  occurredAt: Date;
  source: string;
  referenceId: string;
  idempotencyKey: string;
};

type Projection = {
  currentDays: number;
  longestDays: number;
  lastActivityDate: Date | null;
};

const MINIMUM_CHALLENGE_QUESTIONS = 3;
const ALLOWED_MISSED_DAYS = 1;
const SERIALIZABLE_ATTEMPTS = 3;
const DAY_MS = 86_400_000;

@Injectable()
export class StreaksService {
  constructor(private readonly prisma: PrismaService) {}

  async processChallengeCompletion(input: ChallengeStreakInput) {
    if (input.userId === input.creatorId) {
      return this.ignored(
        input.userId,
        'SELF_CHALLENGE',
        'Un défi créé par soi-même ne prolonge pas une série.'
      );
    }
    if (input.questionCount < MINIMUM_CHALLENGE_QUESTIONS) {
      return this.ignored(
        input.userId,
        'MIN_QUESTIONS',
        `Le défi doit contenir au moins ${MINIMUM_CHALLENGE_QUESTIONS} questions pour compter comme activité.`
      );
    }

    return this.recordActivity({
      userId: input.userId,
      occurredAt: input.completedAt,
      source: 'CHALLENGE_COMPLETION',
      referenceId: input.participantId,
      idempotencyKey: `streak:challenge-completion:${input.participantId}`
    });
  }

  async summary(userId: string, limit = 30) {
    const safeLimit = Math.min(
      Math.max(Number.isFinite(limit) ? Math.floor(limit) : 30, 1),
      90
    );
    const [projection, days] = await Promise.all([
      this.rebuildProjection(userId),
      this.prisma.streakActivityDay.findMany({
        where: { userId },
        orderBy: [{ activityDate: 'desc' }, { id: 'desc' }],
        take: safeLimit
      })
    ]);

    return {
      profile: this.publicProjection(projection),
      days,
      rules: {
        timezone: 'UTC',
        oneCreditPerDay: true,
        allowedMissedDays: ALLOWED_MISSED_DAYS,
        minimumChallengeQuestions: MINIMUM_CHALLENGE_QUESTIONS,
        purchasesAffectStreak: false,
        explanation:
          'Une seule activité éligible compte par jour. Un jour complet peut être manqué sans casser la continuité.'
      }
    };
  }

  async exportForAccount(userId: string) {
    const [projection, days] = await Promise.all([
      this.rebuildProjection(userId),
      this.prisma.streakActivityDay.findMany({
        where: { userId },
        orderBy: [{ activityDate: 'desc' }, { id: 'desc' }]
      })
    ]);
    return { profile: this.publicProjection(projection), days };
  }

  async deleteForAccount(userId: string, tx: Prisma.TransactionClient) {
    await tx.streakActivityDay.deleteMany({ where: { userId } });
    await tx.userActivityStreak.deleteMany({ where: { userId } });
  }

  calculateProjection(activityDates: Date[]): Projection {
    const dates = [...new Set(activityDates.map((date) => this.utcDay(date).getTime()))]
      .sort((left, right) => left - right);
    if (!dates.length) {
      return { currentDays: 0, longestDays: 0, lastActivityDate: null };
    }

    let currentDays = 1;
    let longestDays = 1;
    for (let index = 1; index < dates.length; index += 1) {
      const gapDays = Math.round((dates[index] - dates[index - 1]) / DAY_MS);
      currentDays = gapDays <= ALLOWED_MISSED_DAYS + 1 ? currentDays + 1 : 1;
      longestDays = Math.max(longestDays, currentDays);
    }

    return {
      currentDays,
      longestDays,
      lastActivityDate: new Date(dates[dates.length - 1])
    };
  }

  private async recordActivity(input: ActivityInput) {
    const activityDate = this.utcDay(input.occurredAt);
    const existing = await this.prisma.streakActivityDay.findUnique({
      where: { idempotencyKey: input.idempotencyKey }
    });
    if (existing) {
      return this.activityResponse(
        false,
        true,
        'REPLAYED',
        'Cette complétion avait déjà été prise en compte.',
        await this.rebuildProjection(input.userId)
      );
    }

    for (let attempt = 0; attempt < SERIALIZABLE_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const duplicate = await tx.streakActivityDay.findUnique({
              where: { idempotencyKey: input.idempotencyKey }
            });
            if (duplicate) {
              return this.activityResponse(
                false,
                true,
                'REPLAYED',
                'Cette complétion avait déjà été prise en compte.',
                await this.projectionFromTransaction(tx, input.userId)
              );
            }

            const sameDay = await tx.streakActivityDay.findUnique({
              where: {
                userId_activityDate: { userId: input.userId, activityDate }
              }
            });
            if (sameDay) {
              return this.activityResponse(
                false,
                false,
                'DAY_ALREADY_CREDITED',
                'Une activité éligible a déjà été enregistrée pour cette journée.',
                await this.projectionFromTransaction(tx, input.userId)
              );
            }

            await tx.streakActivityDay.create({
              data: {
                userId: input.userId,
                activityDate,
                source: input.source,
                referenceId: input.referenceId,
                idempotencyKey: input.idempotencyKey
              }
            });
            const projection = await this.projectionFromTransaction(tx, input.userId);
            return this.activityResponse(
              true,
              false,
              'DAY_CREDITED',
              'La journée a été ajoutée à ta série saine.',
              projection
            );
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
      } catch (error) {
        if (this.isUniqueConflict(error)) {
          const projection = await this.rebuildProjection(input.userId);
          const replayed = Boolean(
            await this.prisma.streakActivityDay.findUnique({
              where: { idempotencyKey: input.idempotencyKey }
            })
          );
          return this.activityResponse(
            false,
            replayed,
            replayed ? 'REPLAYED' : 'DAY_ALREADY_CREDITED',
            replayed
              ? 'Cette complétion avait déjà été prise en compte.'
              : 'Une activité éligible a déjà été enregistrée pour cette journée.',
            projection
          );
        }
        if (
          this.isRetryableTransaction(error) &&
          attempt < SERIALIZABLE_ATTEMPTS - 1
        ) {
          await this.transactionBackoff(attempt);
          continue;
        }
        throw error;
      }
    }

    throw new BadRequestException('Série temporairement indisponible.');
  }

  private async ignored(userId: string, reasonCode: string, explanation: string) {
    return this.activityResponse(
      false,
      false,
      reasonCode,
      explanation,
      await this.rebuildProjection(userId)
    );
  }

  private async rebuildProjection(userId: string) {
    for (let attempt = 0; attempt < SERIALIZABLE_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          (tx) => this.projectionFromTransaction(tx, userId),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
      } catch (error) {
        if (
          this.isRetryableTransaction(error) &&
          attempt < SERIALIZABLE_ATTEMPTS - 1
        ) {
          await this.transactionBackoff(attempt);
          continue;
        }
        throw error;
      }
    }
    throw new BadRequestException('Série temporairement indisponible.');
  }

  private async projectionFromTransaction(
    tx: Prisma.TransactionClient,
    userId: string
  ) {
    const days = await tx.streakActivityDay.findMany({
      where: { userId },
      select: { activityDate: true },
      orderBy: { activityDate: 'asc' }
    });
    const calculated = this.calculateProjection(
      days.map((item) => item.activityDate)
    );

    return tx.userActivityStreak.upsert({
      where: { userId },
      create: { userId, ...calculated },
      update: calculated
    });
  }

  private publicProjection(projection: Projection & { updatedAt?: Date }) {
    const today = this.utcDay(new Date());
    const gapDays = projection.lastActivityDate
      ? Math.round((today.getTime() - this.utcDay(projection.lastActivityDate).getTime()) / DAY_MS)
      : null;
    const status =
      gapDays === null
        ? 'NOT_STARTED'
        : gapDays === 0
          ? 'ACTIVE_TODAY'
          : gapDays <= ALLOWED_MISSED_DAYS + 1
            ? 'GRACE_WINDOW'
            : 'INACTIVE';

    return {
      currentDays:
        gapDays !== null && gapDays <= ALLOWED_MISSED_DAYS + 1
          ? projection.currentDays
          : 0,
      longestDays: projection.longestDays,
      lastActivityDate: projection.lastActivityDate,
      status,
      updatedAt: projection.updatedAt ?? null
    };
  }

  private activityResponse(
    credited: boolean,
    replayed: boolean,
    reasonCode: string,
    explanation: string,
    projection: Projection & { updatedAt?: Date }
  ) {
    return {
      credited,
      replayed,
      reasonCode,
      explanation,
      profile: this.publicProjection(projection)
    };
  }

  private utcDay(value: Date) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
    );
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
