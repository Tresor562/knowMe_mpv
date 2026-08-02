import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ChallengeQuestInput = {
  participantId: string;
  userId: string;
  creatorId: string;
  challengeId: string;
  questionCount: number;
  completedAt: Date;
};

type QuestProgress = {
  id: string;
  userId: string;
  questKey: string;
  questDate: Date;
  target: number;
  progress: number;
  status: string;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const DAILY_EXPLORER_KEY = 'daily_challenge_explorer';
const DAILY_EXPLORER_TARGET = 1;
const MINIMUM_CHALLENGE_QUESTIONS = 3;
const SERIALIZABLE_ATTEMPTS = 3;

@Injectable()
export class QuestsService {
  constructor(private readonly prisma: PrismaService) {}

  async processChallengeCompletion(input: ChallengeQuestInput) {
    if (input.userId === input.creatorId) {
      return this.ignored(
        input.userId,
        input.completedAt,
        'SELF_CHALLENGE',
        'Un défi créé par soi-même ne valide pas la quête quotidienne.'
      );
    }
    if (input.questionCount < MINIMUM_CHALLENGE_QUESTIONS) {
      return this.ignored(
        input.userId,
        input.completedAt,
        'MIN_QUESTIONS',
        `Le défi doit contenir au moins ${MINIMUM_CHALLENGE_QUESTIONS} questions.`
      );
    }

    const questDate = this.questDay(input.completedAt);
    const idempotencyKey = `quest:${DAILY_EXPLORER_KEY}:${input.participantId}`;
    const existingContribution = await this.prisma.dailyQuestContribution.findUnique({
      where: { idempotencyKey }
    });
    if (existingContribution) {
      return this.response(
        await this.ensureProgress(input.userId, questDate),
        false,
        true,
        'REPLAYED',
        'Cette participation avait déjà été traitée.'
      );
    }

    for (let attempt = 0; attempt < SERIALIZABLE_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const duplicate = await tx.dailyQuestContribution.findUnique({
              where: { idempotencyKey }
            });
            if (duplicate) {
              return this.response(
                await this.ensureProgressFromTransaction(tx, input.userId, questDate),
                false,
                true,
                'REPLAYED',
                'Cette participation avait déjà été traitée.'
              );
            }

            const progress = await this.ensureProgressFromTransaction(
              tx,
              input.userId,
              questDate
            );
            if (progress.status === 'COMPLETED') {
              return this.response(
                progress,
                false,
                false,
                'QUEST_ALREADY_COMPLETED',
                'La quête du jour est déjà terminée. Aucun farming supplémentaire n’est compté.'
              );
            }

            await tx.dailyQuestContribution.create({
              data: {
                userId: input.userId,
                questKey: DAILY_EXPLORER_KEY,
                questDate,
                source: 'CHALLENGE_COMPLETION',
                referenceId: input.participantId,
                idempotencyKey
              }
            });
            const completed = await tx.dailyQuestProgress.update({
              where: {
                userId_questKey_questDate: {
                  userId: input.userId,
                  questKey: DAILY_EXPLORER_KEY,
                  questDate
                }
              },
              data: {
                progress: DAILY_EXPLORER_TARGET,
                status: 'COMPLETED',
                completedAt: input.completedAt
              }
            });

            return this.response(
              completed,
              true,
              false,
              'QUEST_COMPLETED',
              'La quête quotidienne a été complétée côté serveur.'
            );
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
      } catch (error) {
        if (this.isUniqueConflict(error)) {
          return this.response(
            await this.ensureProgress(input.userId, questDate),
            false,
            false,
            'QUEST_ALREADY_COMPLETED',
            'La quête du jour est déjà terminée. Aucun farming supplémentaire n’est compté.'
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

    throw new BadRequestException('Quête temporairement indisponible.');
  }

  async today(userId: string) {
    const progress = await this.ensureProgress(userId, this.questDay(new Date()));
    return {
      quest: this.publicQuest(progress),
      rules: {
        timezone: 'UTC',
        automaticCompletion: true,
        manualClaimRequired: false,
        paidBoostsAllowed: false,
        reward: null,
        minimumChallengeQuestions: MINIMUM_CHALLENGE_QUESTIONS
      }
    };
  }

  async exportForAccount(userId: string) {
    const [progress, contributions] = await Promise.all([
      this.prisma.dailyQuestProgress.findMany({
        where: { userId },
        orderBy: [{ questDate: 'desc' }, { id: 'desc' }]
      }),
      this.prisma.dailyQuestContribution.findMany({
        where: { userId },
        orderBy: [{ questDate: 'desc' }, { id: 'desc' }]
      })
    ]);
    return { progress, contributions };
  }

  async deleteForAccount(userId: string, tx: Prisma.TransactionClient) {
    await tx.dailyQuestContribution.deleteMany({ where: { userId } });
    await tx.dailyQuestProgress.deleteMany({ where: { userId } });
  }

  questDay(value: Date) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
    );
  }

  private async ignored(
    userId: string,
    occurredAt: Date,
    reasonCode: string,
    explanation: string
  ) {
    return this.response(
      await this.ensureProgress(userId, this.questDay(occurredAt)),
      false,
      false,
      reasonCode,
      explanation
    );
  }

  private async ensureProgress(userId: string, questDate: Date) {
    return this.prisma.dailyQuestProgress.upsert({
      where: {
        userId_questKey_questDate: {
          userId,
          questKey: DAILY_EXPLORER_KEY,
          questDate
        }
      },
      create: {
        userId,
        questKey: DAILY_EXPLORER_KEY,
        questDate,
        target: DAILY_EXPLORER_TARGET
      },
      update: {}
    });
  }

  private async ensureProgressFromTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    questDate: Date
  ) {
    return tx.dailyQuestProgress.upsert({
      where: {
        userId_questKey_questDate: {
          userId,
          questKey: DAILY_EXPLORER_KEY,
          questDate
        }
      },
      create: {
        userId,
        questKey: DAILY_EXPLORER_KEY,
        questDate,
        target: DAILY_EXPLORER_TARGET
      },
      update: {}
    });
  }

  private publicQuest(progress: QuestProgress) {
    return {
      id: progress.id,
      key: progress.questKey,
      title: 'Explorateur du jour',
      description: 'Termine un défi éligible aujourd’hui.',
      questDate: progress.questDate,
      target: progress.target,
      progress: progress.progress,
      status: progress.status,
      completedAt: progress.completedAt,
      updatedAt: progress.updatedAt
    };
  }

  private response(
    progress: QuestProgress,
    completedNow: boolean,
    replayed: boolean,
    reasonCode: string,
    explanation: string
  ) {
    return {
      completedNow,
      replayed,
      reasonCode,
      explanation,
      quest: this.publicQuest(progress)
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
