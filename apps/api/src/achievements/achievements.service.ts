import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AchievementChallengeInput = {
  participantId: string;
  userId: string;
  creatorId: string;
  challengeId: string;
  questionCount: number;
  completedAt: Date;
};

type AchievementGrantWithDefinition = Prisma.AchievementGrantGetPayload<{
  include: { definition: true };
}>;

type CatalogDefinition = {
  key: string;
  version: number;
  type: 'BADGE' | 'TITLE';
  name: string;
  description: string;
  icon: string;
  criteria: Prisma.InputJsonValue;
};

const MINIMUM_CHALLENGE_QUESTIONS = 3;
const SERIALIZABLE_ATTEMPTS = 3;

const CATALOG: CatalogDefinition[] = [
  {
    key: 'first_challenge',
    version: 1,
    type: 'BADGE',
    name: 'Premier pas',
    description: 'A terminé un premier défi KnowMe éligible.',
    icon: '🌱',
    criteria: { event: 'CHALLENGE_COMPLETION', minimumEligibleCompletions: 1 }
  },
  {
    key: 'explorer',
    version: 1,
    type: 'TITLE',
    name: 'Explorateur',
    description: 'Titre obtenu après un premier défi éligible.',
    icon: '🧭',
    criteria: { event: 'CHALLENGE_COMPLETION', minimumEligibleCompletions: 1 }
  },
  {
    key: 'level_two',
    version: 1,
    type: 'BADGE',
    name: 'Curiosité confirmée',
    description: 'A atteint le niveau 2 depuis le registre XP autoritaire.',
    icon: '✨',
    criteria: { event: 'LEVEL_REACHED', minimumLevel: 2 }
  },
  {
    key: 'curious_mind',
    version: 1,
    type: 'TITLE',
    name: 'Esprit curieux',
    description: 'Titre obtenu en atteignant le niveau 2.',
    icon: '🔎',
    criteria: { event: 'LEVEL_REACHED', minimumLevel: 2 }
  }
];

@Injectable()
export class AchievementsService {
  constructor(private readonly prisma: PrismaService) {}

  async processChallengeCompletion(
    input: AchievementChallengeInput,
    progressionLevel: number
  ) {
    if (input.userId === input.creatorId) {
      return {
        reasonCode: 'SELF_CHALLENGE',
        explanation: 'Un auto-défi ne peut attribuer aucun badge de mérite.',
        grantedNow: [],
        replayed: [],
        summary: await this.summary(input.userId)
      };
    }
    if (input.questionCount < MINIMUM_CHALLENGE_QUESTIONS) {
      return {
        reasonCode: 'MIN_QUESTIONS',
        explanation: `Le défi doit contenir au moins ${MINIMUM_CHALLENGE_QUESTIONS} questions.`,
        grantedNow: [],
        replayed: [],
        summary: await this.summary(input.userId)
      };
    }

    const definitions = await this.ensureCatalog();
    const keys = ['first_challenge', 'explorer'];
    if (progressionLevel >= 2) keys.push('level_two', 'curious_mind');

    const decisions = [] as Array<{
      grantedNow: boolean;
      replayed: boolean;
      grant: AchievementGrantWithDefinition;
    }>;
    for (const key of keys) {
      const definition = definitions.find((item) => item.key === key);
      if (!definition) continue;
      decisions.push(
        await this.grant({
          userId: input.userId,
          definitionId: definition.id,
          definitionKey: definition.key,
          definitionVersion: definition.version,
          referenceId: input.participantId,
          metadata: {
            challengeId: input.challengeId,
            participantId: input.participantId,
            progressionLevel,
            completedAt: input.completedAt.toISOString()
          }
        })
      );
    }

    return {
      reasonCode: decisions.some((decision) => decision.grantedNow)
        ? 'ACHIEVEMENTS_GRANTED'
        : 'ACHIEVEMENTS_REPLAYED',
      explanation: decisions.some((decision) => decision.grantedNow)
        ? 'Les nouveaux mérites ont été attribués côté serveur.'
        : 'Les mérites avaient déjà été attribués.',
      grantedNow: decisions
        .filter((decision) => decision.grantedNow)
        .map((decision) => this.publicGrant(decision.grant)),
      replayed: decisions
        .filter((decision) => decision.replayed)
        .map((decision) => this.publicGrant(decision.grant)),
      summary: await this.summary(input.userId)
    };
  }

  async summary(userId: string) {
    await this.ensureCatalog();
    const [preference, grants] = await Promise.all([
      this.prisma.userAchievementPreference.findUnique({ where: { userId } }),
      this.prisma.achievementGrant.findMany({
        where: { userId },
        include: { definition: true },
        orderBy: [{ grantedAt: 'desc' }, { id: 'desc' }]
      })
    ]);
    const active = grants.filter(
      (grant) => !grant.revokedAt && grant.definition.active
    );
    const selected = active.find(
      (grant) =>
        grant.id === preference?.selectedTitleGrantId &&
        grant.definition.type === 'TITLE'
    );

    return {
      selectedTitle: selected ? this.publicGrant(selected) : null,
      badges: active
        .filter((grant) => grant.definition.type === 'BADGE')
        .map((grant) => this.publicGrant(grant)),
      titles: active
        .filter((grant) => grant.definition.type === 'TITLE')
        .map((grant) => this.publicGrant(grant)),
      history: grants.map((grant) => this.publicGrant(grant)),
      rules: {
        serverAuthoritative: true,
        paidMeritAllowed: false,
        verificationSeparation: true,
        staffSeparation: true,
        premiumSeparation: true
      }
    };
  }

  async selectTitle(userId: string, grantId?: string | null) {
    const normalizedGrantId = grantId?.trim() || null;
    if (normalizedGrantId) {
      const grant = await this.prisma.achievementGrant.findFirst({
        where: {
          id: normalizedGrantId,
          userId,
          revokedAt: null,
          definition: { type: 'TITLE', active: true }
        },
        include: { definition: true }
      });
      if (!grant) {
        throw new BadRequestException(
          'Ce titre n’est pas actif ou n’appartient pas à ce compte.'
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userAchievementPreference.upsert({
        where: { userId },
        create: { userId, selectedTitleGrantId: normalizedGrantId },
        update: { selectedTitleGrantId: normalizedGrantId }
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'ACHIEVEMENT_TITLE_SELECT',
          entity: 'UserAchievementPreference',
          entityId: userId,
          targetAccountId: userId,
          metadata: { selectedTitleGrantId: normalizedGrantId }
        }
      });
    });

    return this.summary(userId);
  }

  async revoke(actorId: string, grantId: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const grant = await tx.achievementGrant.findUnique({
        where: { id: grantId },
        include: { definition: true }
      });
      if (!grant) throw new NotFoundException('Attribution introuvable.');
      if (grant.revokedAt) {
        return { replayed: true, grant: this.publicGrant(grant) };
      }

      const revoked = await tx.achievementGrant.update({
        where: { id: grantId },
        data: {
          revokedAt: new Date(),
          revokedById: actorId,
          revokeReason: reason.trim()
        },
        include: { definition: true }
      });
      await tx.userAchievementPreference.updateMany({
        where: { userId: grant.userId, selectedTitleGrantId: grant.id },
        data: { selectedTitleGrantId: null }
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'ACHIEVEMENT_REVOKE',
          entity: 'AchievementGrant',
          entityId: grant.id,
          targetAccountId: grant.userId,
          metadata: {
            definitionKey: grant.definition.key,
            definitionVersion: grant.definition.version,
            reason: reason.trim()
          }
        }
      });

      return { replayed: false, grant: this.publicGrant(revoked) };
    });
  }

  async listCatalog() {
    await this.ensureCatalog();
    return this.prisma.achievementDefinition.findMany({
      orderBy: [{ type: 'asc' }, { key: 'asc' }, { version: 'desc' }]
    });
  }

  async listGrants(userId?: string) {
    return this.prisma.achievementGrant.findMany({
      where: userId ? { userId } : undefined,
      include: { definition: true },
      orderBy: [{ grantedAt: 'desc' }, { id: 'desc' }],
      take: 200
    });
  }

  private async ensureCatalog() {
    return Promise.all(
      CATALOG.map((definition) =>
        this.prisma.achievementDefinition.upsert({
          where: {
            key_version: { key: definition.key, version: definition.version }
          },
          create: definition,
          update: {
            type: definition.type,
            name: definition.name,
            description: definition.description,
            icon: definition.icon,
            criteria: definition.criteria,
            active: true
          }
        })
      )
    );
  }

  private async grant(input: {
    userId: string;
    definitionId: string;
    definitionKey: string;
    definitionVersion: number;
    referenceId: string;
    metadata: Prisma.InputJsonValue;
  }) {
    const idempotencyKey = `achievement:${input.definitionKey}:v${input.definitionVersion}:${input.userId}`;
    const existing = await this.prisma.achievementGrant.findUnique({
      where: {
        userId_definitionId: {
          userId: input.userId,
          definitionId: input.definitionId
        }
      },
      include: { definition: true }
    });
    if (existing) return { grantedNow: false, replayed: true, grant: existing };

    for (let attempt = 0; attempt < SERIALIZABLE_ATTEMPTS; attempt += 1) {
      try {
        const grant = await this.prisma.$transaction(
          async (tx) => {
            const duplicate = await tx.achievementGrant.findUnique({
              where: {
                userId_definitionId: {
                  userId: input.userId,
                  definitionId: input.definitionId
                }
              },
              include: { definition: true }
            });
            if (duplicate) return duplicate;

            const created = await tx.achievementGrant.create({
              data: {
                userId: input.userId,
                definitionId: input.definitionId,
                source: 'CHALLENGE_MILESTONE',
                reason: 'Mérite calculé depuis un événement serveur vérifié.',
                idempotencyKey,
                referenceType: 'CHALLENGE_PARTICIPANT',
                referenceId: input.referenceId,
                metadata: input.metadata
              },
              include: { definition: true }
            });
            await tx.auditLog.create({
              data: {
                action: 'ACHIEVEMENT_GRANT',
                entity: 'AchievementGrant',
                entityId: created.id,
                targetAccountId: input.userId,
                metadata: {
                  definitionKey: input.definitionKey,
                  definitionVersion: input.definitionVersion,
                  source: 'CHALLENGE_MILESTONE'
                }
              }
            });
            return created;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
        return { grantedNow: true, replayed: false, grant };
      } catch (error) {
        if (this.isUniqueConflict(error)) {
          const duplicate = await this.prisma.achievementGrant.findFirst({
            where: {
              OR: [
                { idempotencyKey },
                { userId: input.userId, definitionId: input.definitionId }
              ]
            },
            include: { definition: true }
          });
          if (duplicate) {
            return { grantedNow: false, replayed: true, grant: duplicate };
          }
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

    throw new BadRequestException('Attribution temporairement indisponible.');
  }

  private publicGrant(grant: AchievementGrantWithDefinition) {
    return {
      id: grant.id,
      userId: grant.userId,
      source: grant.source,
      reason: grant.reason,
      referenceType: grant.referenceType,
      referenceId: grant.referenceId,
      grantedAt: grant.grantedAt,
      revokedAt: grant.revokedAt,
      revokedById: grant.revokedById,
      revokeReason: grant.revokeReason,
      definition: {
        id: grant.definition.id,
        key: grant.definition.key,
        version: grant.definition.version,
        type: grant.definition.type,
        name: grant.definition.name,
        description: grant.definition.description,
        icon: grant.definition.icon
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
