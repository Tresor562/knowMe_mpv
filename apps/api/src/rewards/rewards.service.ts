import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import {
  CreateRewardPolicyDto,
  SetRewardPolicyStatusDto
} from './dto/reward-policy.dto';

export type ChallengeCompletionRewardInput = {
  participantId: string;
  userId: string;
  creatorId: string;
  challengeId: string;
  questionCount: number;
  completedAt: Date;
};

@Injectable()
export class RewardsService implements OnModuleInit {
  private defaultsPromise: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly audit: AuditService
  ) {}

  async onModuleInit() {
    await this.ensureDefaults();
  }

  ensureDefaults() {
    if (!this.defaultsPromise) {
      this.defaultsPromise = this.initializeDefaults().catch((error) => {
        this.defaultsPromise = null;
        throw error;
      });
    }
    return this.defaultsPromise;
  }

  async preview(eventType = 'CHALLENGE_COMPLETION') {
    await this.ensureDefaults();
    const now = new Date();
    const policy = await this.prisma.rewardPolicy.findFirst({
      where: {
        eventType: this.normalizeEventType(eventType),
        enabled: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }]
      },
      orderBy: { version: 'desc' }
    });

    if (!policy) return null;
    return {
      key: policy.key,
      version: policy.version,
      eventType: policy.eventType,
      amount: policy.amount,
      dailyLimitPerUser: policy.dailyLimitPerUser,
      maxPerEntity: policy.maxPerEntity,
      minQuestions: policy.minQuestions,
      startsAt: policy.startsAt,
      endsAt: policy.endsAt
    };
  }

  async history(userId: string, cursor?: string, limit = 30) {
    await this.ensureDefaults();
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const events = await this.prisma.rewardEvent.findMany({
      where: { userId },
      include: {
        policy: {
          select: {
            key: true,
            version: true,
            eventType: true,
            amount: true
          }
        }
      },
      take: safeLimit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });

    const hasMore = events.length > safeLimit;
    const items = hasMore ? events.slice(0, safeLimit) : events;
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null
    };
  }

  async processChallengeCompletion(input: ChallengeCompletionRewardInput) {
    await this.ensureDefaults();
    const eventType = 'CHALLENGE_COMPLETION';
    const idempotencyKey = `reward:challenge-completion:${input.participantId}`;

    const existing = await this.prisma.rewardEvent.findUnique({
      where: { idempotencyKey },
      include: { policy: true }
    });
    if (existing) return { event: existing, replayed: true };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const duplicate = await tx.rewardEvent.findUnique({
              where: { idempotencyKey },
              include: { policy: true }
            });
            if (duplicate) return { event: duplicate, replayed: true };

            const policy = await tx.rewardPolicy.findFirst({
              where: { eventType },
              orderBy: { version: 'desc' }
            });
            if (!policy) {
              throw new NotFoundException('Politique de récompense introuvable.');
            }

            const now = new Date();
            const ignored = this.evaluateEligibility(policy, input, now);
            if (ignored) {
              const event = await tx.rewardEvent.create({
                data: {
                  userId: input.userId,
                  policyId: policy.id,
                  eventType,
                  entityType: 'CHALLENGE',
                  entityId: input.challengeId,
                  idempotencyKey,
                  status: ignored.status,
                  amount: 0,
                  reasonCode: ignored.reasonCode,
                  explanation: ignored.explanation,
                  processedAt: now,
                  metadata: {
                    participantId: input.participantId,
                    questionCount: input.questionCount,
                    creatorId: input.creatorId
                  }
                },
                include: { policy: true }
              });
              return { event, replayed: false };
            }

            const entityAwards = await tx.rewardEvent.count({
              where: {
                userId: input.userId,
                eventType,
                entityType: 'CHALLENGE',
                entityId: input.challengeId,
                status: 'AWARDED'
              }
            });
            if (entityAwards >= policy.maxPerEntity) {
              const event = await tx.rewardEvent.create({
                data: {
                  userId: input.userId,
                  policyId: policy.id,
                  eventType,
                  entityType: 'CHALLENGE',
                  entityId: input.challengeId,
                  idempotencyKey,
                  status: 'IGNORED',
                  amount: 0,
                  reasonCode: 'ENTITY_LIMIT',
                  explanation: 'La récompense maximale pour ce défi a déjà été attribuée.',
                  processedAt: now,
                  metadata: { participantId: input.participantId }
                },
                include: { policy: true }
              });
              return { event, replayed: false };
            }

            const startOfDay = new Date(Date.UTC(
              now.getUTCFullYear(),
              now.getUTCMonth(),
              now.getUTCDate()
            ));
            const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
            const daily = await tx.rewardEvent.aggregate({
              where: {
                userId: input.userId,
                eventType,
                status: 'AWARDED',
                createdAt: { gte: startOfDay, lt: endOfDay }
              },
              _sum: { amount: true }
            });
            const awardedToday = daily._sum.amount ?? 0;

            if (awardedToday + policy.amount > policy.dailyLimitPerUser) {
              const event = await tx.rewardEvent.create({
                data: {
                  userId: input.userId,
                  policyId: policy.id,
                  eventType,
                  entityType: 'CHALLENGE',
                  entityId: input.challengeId,
                  idempotencyKey,
                  status: 'REJECTED',
                  amount: 0,
                  reasonCode: 'DAILY_LIMIT',
                  explanation: 'Le plafond quotidien de récompenses est atteint.',
                  processedAt: now,
                  metadata: {
                    participantId: input.participantId,
                    awardedToday,
                    dailyLimitPerUser: policy.dailyLimitPerUser
                  }
                },
                include: { policy: true }
              });
              return { event, replayed: false };
            }

            const ledger = await this.wallet.applyInTransaction(tx, {
              userId: input.userId,
              amount: policy.amount,
              type: 'CHALLENGE_COMPLETION_REWARD',
              source: 'REWARD',
              idempotencyKey: `ledger:${idempotencyKey}`,
              reason: `Récompense défi selon ${policy.key} v${policy.version}.`,
              referenceType: 'CHALLENGE_PARTICIPANT',
              referenceId: input.participantId,
              metadata: {
                rewardPolicyId: policy.id,
                rewardPolicyKey: policy.key,
                rewardPolicyVersion: policy.version,
                challengeId: input.challengeId
              }
            });

            const event = await tx.rewardEvent.create({
              data: {
                userId: input.userId,
                policyId: policy.id,
                eventType,
                entityType: 'CHALLENGE',
                entityId: input.challengeId,
                idempotencyKey,
                status: 'AWARDED',
                amount: policy.amount,
                reasonCode: 'ELIGIBLE',
                explanation: `${policy.amount} KnowCoins attribués pour la complétion du défi.`,
                ledgerEntryId: ledger.entry.id,
                processedAt: now,
                metadata: {
                  participantId: input.participantId,
                  questionCount: input.questionCount,
                  completedAt: input.completedAt.toISOString()
                }
              },
              include: { policy: true }
            });

            return { event, replayed: ledger.replayed };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
      } catch (error) {
        if (this.isUniqueConflict(error)) {
          const duplicate = await this.prisma.rewardEvent.findUnique({
            where: { idempotencyKey },
            include: { policy: true }
          });
          if (duplicate) return { event: duplicate, replayed: true };
        }
        if (this.isRetryableTransaction(error) && attempt < 2) continue;
        throw error;
      }
    }

    throw new BadRequestException('Récompense temporairement indisponible.');
  }

  async listPolicies() {
    await this.ensureDefaults();
    return this.prisma.rewardPolicy.findMany({
      orderBy: [{ key: 'asc' }, { version: 'desc' }]
    });
  }

  async listEvents(userId?: string, status?: string) {
    await this.ensureDefaults();
    return this.prisma.rewardEvent.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(status ? { status: status.toUpperCase() } : {})
      },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, email: true }
        },
        policy: true
      },
      orderBy: { createdAt: 'desc' },
      take: 300
    });
  }

  async createPolicy(actorId: string, dto: CreateRewardPolicyDto) {
    await this.ensureDefaults();
    const key = this.normalizeKey(dto.key);
    const eventType = this.normalizeEventType(dto.eventType);
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date();
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;

    if (dto.dailyLimitPerUser < dto.amount) {
      throw new BadRequestException(
        'Le plafond quotidien doit être supérieur ou égal au montant unitaire.'
      );
    }
    if (endsAt && endsAt <= startsAt) {
      throw new BadRequestException(
        'La date de fin doit être postérieure au début de la politique.'
      );
    }

    const policy = await this.prisma.$transaction(
      async (tx) => {
        const latest = await tx.rewardPolicy.aggregate({
          where: { key },
          _max: { version: true }
        });
        return tx.rewardPolicy.create({
          data: {
            key,
            version: (latest._max.version ?? 0) + 1,
            eventType,
            enabled: true,
            amount: dto.amount,
            dailyLimitPerUser: dto.dailyLimitPerUser,
            maxPerEntity: dto.maxPerEntity ?? 1,
            minQuestions: dto.minQuestions ?? 0,
            startsAt,
            endsAt,
            createdById: actorId,
            reason: dto.reason.trim()
          }
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    await this.audit.record({
      actorId,
      action: 'REWARD_POLICY_CREATE',
      entity: 'RewardPolicy',
      entityId: policy.id,
      metadata: {
        key: policy.key,
        version: policy.version,
        eventType: policy.eventType,
        amount: policy.amount,
        dailyLimitPerUser: policy.dailyLimitPerUser,
        reason: dto.reason.trim()
      }
    });

    return policy;
  }

  async setPolicyStatus(
    actorId: string,
    policyId: string,
    dto: SetRewardPolicyStatusDto
  ) {
    const current = await this.prisma.rewardPolicy.findUnique({
      where: { id: policyId }
    });
    if (!current) throw new NotFoundException('Politique de récompense introuvable.');

    const updated = await this.prisma.rewardPolicy.update({
      where: { id: policyId },
      data: { enabled: dto.enabled, reason: dto.reason.trim() }
    });

    await this.audit.record({
      actorId,
      action: dto.enabled ? 'REWARD_POLICY_ENABLE' : 'REWARD_POLICY_DISABLE',
      entity: 'RewardPolicy',
      entityId: policyId,
      metadata: {
        key: current.key,
        version: current.version,
        previousEnabled: current.enabled,
        enabled: dto.enabled,
        reason: dto.reason.trim()
      }
    });

    return updated;
  }

  private evaluateEligibility(
    policy: {
      enabled: boolean;
      startsAt: Date;
      endsAt: Date | null;
      minQuestions: number;
    },
    input: ChallengeCompletionRewardInput,
    now: Date
  ) {
    if (!policy.enabled) {
      return {
        status: 'IGNORED',
        reasonCode: 'POLICY_DISABLED',
        explanation: 'La politique de récompense est désactivée.'
      };
    }
    if (policy.startsAt > now || (policy.endsAt && policy.endsAt <= now)) {
      return {
        status: 'IGNORED',
        reasonCode: 'POLICY_INACTIVE',
        explanation: 'La politique de récompense n’est pas active à cette date.'
      };
    }
    if (input.userId === input.creatorId) {
      return {
        status: 'IGNORED',
        reasonCode: 'SELF_CHALLENGE',
        explanation: 'Le créateur ne reçoit pas de récompense pour son propre défi.'
      };
    }
    if (input.questionCount < policy.minQuestions) {
      return {
        status: 'IGNORED',
        reasonCode: 'MIN_QUESTIONS',
        explanation: `Le défi doit contenir au moins ${policy.minQuestions} questions.`
      };
    }
    return null;
  }

  private async initializeDefaults() {
    await this.prisma.rewardPolicy.upsert({
      where: {
        key_version: {
          key: 'challenge_completion',
          version: 1
        }
      },
      create: {
        key: 'challenge_completion',
        version: 1,
        eventType: 'CHALLENGE_COMPLETION',
        enabled: true,
        amount: 25,
        dailyLimitPerUser: 100,
        maxPerEntity: 1,
        minQuestions: 3,
        startsAt: new Date(0),
        reason: 'Politique initiale de récompense des défis KnowMe.'
      },
      update: {}
    });
  }

  private normalizeKey(value: string) {
    return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '_');
  }

  private normalizeEventType(value: string) {
    return value.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_');
  }

  private isRetryableTransaction(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
  }

  private isUniqueConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
