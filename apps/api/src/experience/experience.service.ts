import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { PublishExperienceCurveDto } from './dto/experience-curve.dto';
import {
  CreateExperiencePolicyDto,
  SetExperiencePolicyStatusDto
} from './dto/experience-policy.dto';

export type ChallengeCompletionExperienceInput = {
  participantId: string;
  userId: string;
  creatorId: string;
  challengeId: string;
  questionCount: number;
  completedAt: Date;
};

type LevelDefinition = {
  level: number;
  minimumXp: number;
  title: string;
};

@Injectable()
export class ExperienceService implements OnModuleInit {
  private defaultsPromise: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
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

  async profile(userId: string) {
    await this.ensureDefaults();
    const profile = await this.ensureProfile(userId);
    const curve = await this.curve(profile.curveVersion);
    return this.presentProfile(profile, curve);
  }

  async history(userId: string, cursor?: string, limit = 30) {
    await this.ensureDefaults();
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const entries = await this.prisma.experienceLedgerEntry.findMany({
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

  async processChallengeCompletion(input: ChallengeCompletionExperienceInput) {
    await this.ensureDefaults();
    const eventType = 'CHALLENGE_COMPLETION';
    const idempotencyKey = `xp:challenge-completion:${input.participantId}`;

    const existing = await this.prisma.experienceLedgerEntry.findUnique({
      where: { idempotencyKey }
    });
    if (existing) {
      return {
        entry: existing,
        profile: await this.profile(input.userId),
        replayed: true
      };
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await this.prisma.$transaction(
          async (tx) => {
            const duplicate = await tx.experienceLedgerEntry.findUnique({
              where: { idempotencyKey }
            });
            if (duplicate) {
              const currentProfile = await tx.experienceProfile.findUnique({
                where: { userId: input.userId }
              });
              return { entry: duplicate, profile: currentProfile, replayed: true };
            }

            const policy = await tx.experiencePolicy.findFirst({
              where: { eventType },
              orderBy: { version: 'desc' }
            });
            if (!policy) {
              throw new NotFoundException('Politique XP introuvable.');
            }

            const latestCurve = await tx.experienceLevelDefinition.aggregate({
              _max: { curveVersion: true }
            });
            const profile = await tx.experienceProfile.upsert({
              where: { userId: input.userId },
              create: {
                userId: input.userId,
                curveVersion: latestCurve._max.curveVersion ?? 1
              },
              update: {}
            });
            const levels = await tx.experienceLevelDefinition.findMany({
              where: { curveVersion: profile.curveVersion },
              orderBy: { minimumXp: 'asc' }
            });
            if (!levels.length) {
              throw new NotFoundException('Courbe de niveaux XP introuvable.');
            }

            const ignored = this.evaluateEligibility(policy, input, new Date());
            if (ignored) {
              const entry = await tx.experienceLedgerEntry.create({
                data: {
                  userId: input.userId,
                  policyId: policy.id,
                  policyKey: policy.key,
                  policyVersion: policy.version,
                  eventType,
                  entityType: 'CHALLENGE_PARTICIPANT',
                  entityId: input.participantId,
                  idempotencyKey,
                  status: 'IGNORED',
                  amount: 0,
                  totalBefore: profile.totalXp,
                  totalAfter: profile.totalXp,
                  levelBefore: profile.level,
                  levelAfter: profile.level,
                  curveVersion: profile.curveVersion,
                  reasonCode: ignored.reasonCode,
                  explanation: ignored.explanation,
                  metadata: {
                    challengeId: input.challengeId,
                    questionCount: input.questionCount,
                    creatorId: input.creatorId,
                    completedAt: input.completedAt.toISOString()
                  }
                }
              });
              return { entry, profile, replayed: false };
            }

            const totalAfter = profile.totalXp + policy.amount;
            const levelAfter = this.resolveLevel(totalAfter, levels);
            const updatedProfile = await tx.experienceProfile.update({
              where: { userId: input.userId },
              data: {
                totalXp: totalAfter,
                level: levelAfter.level,
                version: { increment: 1 }
              }
            });
            const entry = await tx.experienceLedgerEntry.create({
              data: {
                userId: input.userId,
                policyId: policy.id,
                policyKey: policy.key,
                policyVersion: policy.version,
                eventType,
                entityType: 'CHALLENGE_PARTICIPANT',
                entityId: input.participantId,
                idempotencyKey,
                status: 'AWARDED',
                amount: policy.amount,
                totalBefore: profile.totalXp,
                totalAfter,
                levelBefore: profile.level,
                levelAfter: levelAfter.level,
                curveVersion: profile.curveVersion,
                reasonCode: 'ELIGIBLE',
                explanation:
                  levelAfter.level > profile.level
                    ? `${policy.amount} XP attribués. Niveau ${levelAfter.level} atteint : ${levelAfter.title}.`
                    : `${policy.amount} XP attribués pour la complétion du défi.`,
                metadata: {
                  challengeId: input.challengeId,
                  questionCount: input.questionCount,
                  creatorId: input.creatorId,
                  completedAt: input.completedAt.toISOString(),
                  levelTitle: levelAfter.title
                }
              }
            });
            return { entry, profile: updatedProfile, replayed: false };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );

        const curve = result.profile
          ? await this.curve(result.profile.curveVersion)
          : await this.curve(1);
        return {
          entry: result.entry,
          profile: result.profile
            ? this.presentProfile(result.profile, curve)
            : await this.profile(input.userId),
          replayed: result.replayed
        };
      } catch (error) {
        if (this.isUniqueConflict(error)) {
          const duplicate = await this.prisma.experienceLedgerEntry.findUnique({
            where: { idempotencyKey }
          });
          if (duplicate) {
            return {
              entry: duplicate,
              profile: await this.profile(input.userId),
              replayed: true
            };
          }
        }
        if (this.isRetryableTransaction(error) && attempt < 2) continue;
        throw error;
      }
    }

    throw new BadRequestException('Attribution XP temporairement indisponible.');
  }

  async listPolicies() {
    await this.ensureDefaults();
    return this.prisma.experiencePolicy.findMany({
      orderBy: [{ key: 'asc' }, { version: 'desc' }]
    });
  }

  async createPolicy(actorId: string, dto: CreateExperiencePolicyDto) {
    await this.ensureDefaults();
    const key = this.normalizeKey(dto.key);
    const eventType = this.normalizeEventType(dto.eventType);
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date();
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (endsAt && endsAt <= startsAt) {
      throw new BadRequestException(
        'La date de fin doit être postérieure au début de la politique.'
      );
    }

    const policy = await this.prisma.$transaction(
      async (tx) => {
        const latest = await tx.experiencePolicy.aggregate({
          where: { key },
          _max: { version: true }
        });
        return tx.experiencePolicy.create({
          data: {
            key,
            version: (latest._max.version ?? 0) + 1,
            eventType,
            enabled: true,
            amount: dto.amount,
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
      action: 'EXPERIENCE_POLICY_CREATE',
      entity: 'ExperiencePolicy',
      entityId: policy.id,
      metadata: {
        key: policy.key,
        version: policy.version,
        eventType: policy.eventType,
        amount: policy.amount,
        minQuestions: policy.minQuestions,
        reason: policy.reason
      }
    });
    return policy;
  }

  async setPolicyStatus(
    actorId: string,
    policyId: string,
    dto: SetExperiencePolicyStatusDto
  ) {
    const current = await this.prisma.experiencePolicy.findUnique({
      where: { id: policyId }
    });
    if (!current) throw new NotFoundException('Politique XP introuvable.');

    const updated = await this.prisma.experiencePolicy.update({
      where: { id: policyId },
      data: { enabled: dto.enabled, reason: dto.reason.trim() }
    });
    await this.audit.record({
      actorId,
      action: dto.enabled
        ? 'EXPERIENCE_POLICY_ENABLE'
        : 'EXPERIENCE_POLICY_DISABLE',
      entity: 'ExperiencePolicy',
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

  async listLedger(userId?: string, status?: string) {
    await this.ensureDefaults();
    return this.prisma.experienceLedgerEntry.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(status ? { status: status.toUpperCase() } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 300
    });
  }

  async listCurves() {
    await this.ensureDefaults();
    const levels = await this.prisma.experienceLevelDefinition.findMany({
      orderBy: [{ curveVersion: 'desc' }, { level: 'asc' }]
    });
    const grouped = new Map<number, typeof levels>();
    for (const level of levels) {
      grouped.set(level.curveVersion, [
        ...(grouped.get(level.curveVersion) ?? []),
        level
      ]);
    }
    return [...grouped.entries()].map(([curveVersion, definitions]) => ({
      curveVersion,
      levels: definitions
    }));
  }

  async publishCurve(actorId: string, dto: PublishExperienceCurveDto) {
    await this.ensureDefaults();
    const levels = [...dto.levels]
      .map((level) => ({
        level: level.level,
        minimumXp: level.minimumXp,
        title: level.title.trim()
      }))
      .sort((left, right) => left.level - right.level);
    this.validateCurve(levels);

    const result = await this.prisma.$transaction(
      async (tx) => {
        const latest = await tx.experienceLevelDefinition.aggregate({
          _max: { curveVersion: true }
        });
        const curveVersion = (latest._max.curveVersion ?? 0) + 1;
        await tx.experienceLevelDefinition.createMany({
          data: levels.map((level) => ({ ...level, curveVersion }))
        });
        return { curveVersion, levels };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    await this.audit.record({
      actorId,
      action: 'EXPERIENCE_CURVE_PUBLISH',
      entity: 'ExperienceLevelDefinition',
      entityId: `curve:${result.curveVersion}`,
      metadata: {
        curveVersion: result.curveVersion,
        levelCount: result.levels.length,
        maximumXp: result.levels[result.levels.length - 1]?.minimumXp ?? 0,
        reason: dto.reason.trim()
      }
    });
    return result;
  }

  private async initializeDefaults() {
    await this.prisma.$transaction(async (tx) => {
      await tx.experienceLevelDefinition.createMany({
        data: [
          { curveVersion: 1, level: 1, minimumXp: 0, title: 'Nouveau lien' },
          { curveVersion: 1, level: 2, minimumXp: 100, title: 'Curieux' },
          { curveVersion: 1, level: 3, minimumXp: 250, title: 'Complice' },
          { curveVersion: 1, level: 4, minimumXp: 500, title: 'Confident' },
          { curveVersion: 1, level: 5, minimumXp: 900, title: 'Explorateur' },
          { curveVersion: 1, level: 6, minimumXp: 1400, title: 'Connecteur' },
          { curveVersion: 1, level: 7, minimumXp: 2100, title: 'Catalyseur' },
          { curveVersion: 1, level: 8, minimumXp: 3000, title: 'Éclaireur' },
          { curveVersion: 1, level: 9, minimumXp: 4200, title: 'Architecte social' },
          { curveVersion: 1, level: 10, minimumXp: 6000, title: 'Constellation' }
        ],
        skipDuplicates: true
      });
      await tx.experiencePolicy.upsert({
        where: {
          key_version: { key: 'challenge_completion', version: 1 }
        },
        create: {
          key: 'challenge_completion',
          version: 1,
          eventType: 'CHALLENGE_COMPLETION',
          enabled: true,
          amount: 40,
          minQuestions: 3,
          startsAt: new Date(0),
          reason: 'Politique XP initiale des défis KnowMe.'
        },
        update: {}
      });
    });
  }

  private async ensureProfile(userId: string) {
    const latestCurve = await this.prisma.experienceLevelDefinition.aggregate({
      _max: { curveVersion: true }
    });
    return this.prisma.experienceProfile.upsert({
      where: { userId },
      create: {
        userId,
        curveVersion: latestCurve._max.curveVersion ?? 1
      },
      update: {}
    });
  }

  private async curve(curveVersion: number) {
    return this.prisma.experienceLevelDefinition.findMany({
      where: { curveVersion },
      orderBy: { minimumXp: 'asc' }
    });
  }

  private presentProfile(
    profile: {
      userId: string;
      totalXp: number;
      level: number;
      curveVersion: number;
      version: number;
      createdAt: Date;
      updatedAt: Date;
    },
    curve: LevelDefinition[]
  ) {
    const current = this.resolveLevel(profile.totalXp, curve);
    const next = curve.find((level) => level.level > current.level) ?? null;
    const gainedInLevel = profile.totalXp - current.minimumXp;
    const levelSpan = next ? next.minimumXp - current.minimumXp : 0;
    return {
      ...profile,
      level: current.level,
      title: current.title,
      currentLevelMinimumXp: current.minimumXp,
      nextLevel: next
        ? {
            level: next.level,
            title: next.title,
            minimumXp: next.minimumXp,
            remainingXp: Math.max(next.minimumXp - profile.totalXp, 0)
          }
        : null,
      progressPercent: next
        ? Math.min(Math.round((gainedInLevel / levelSpan) * 100), 100)
        : 100
    };
  }

  private resolveLevel(totalXp: number, curve: LevelDefinition[]) {
    const eligible = curve.filter((level) => level.minimumXp <= totalXp);
    return eligible[eligible.length - 1] ?? curve[0];
  }

  private validateCurve(levels: LevelDefinition[]) {
    if (levels[0]?.level !== 1 || levels[0]?.minimumXp !== 0) {
      throw new BadRequestException(
        'La courbe doit commencer au niveau 1 avec 0 XP.'
      );
    }
    for (let index = 0; index < levels.length; index += 1) {
      const current = levels[index];
      const previous = levels[index - 1];
      if (current.level !== index + 1) {
        throw new BadRequestException(
          'Les niveaux doivent être continus et commencer à 1.'
        );
      }
      if (previous && current.minimumXp <= previous.minimumXp) {
        throw new BadRequestException(
          'Les seuils XP doivent être strictement croissants.'
        );
      }
    }
  }

  private evaluateEligibility(
    policy: {
      enabled: boolean;
      startsAt: Date;
      endsAt: Date | null;
      minQuestions: number;
    },
    input: ChallengeCompletionExperienceInput,
    now: Date
  ) {
    if (!policy.enabled) {
      return {
        reasonCode: 'POLICY_DISABLED',
        explanation: 'La politique XP est désactivée.'
      };
    }
    if (policy.startsAt > now || (policy.endsAt && policy.endsAt <= now)) {
      return {
        reasonCode: 'POLICY_INACTIVE',
        explanation: 'La politique XP n’est pas active à cette date.'
      };
    }
    if (input.userId === input.creatorId) {
      return {
        reasonCode: 'SELF_CHALLENGE',
        explanation: 'Le créateur ne gagne pas d’XP sur son propre défi.'
      };
    }
    if (input.questionCount < policy.minQuestions) {
      return {
        reasonCode: 'MIN_QUESTIONS',
        explanation: `Le défi doit contenir au moins ${policy.minQuestions} questions.`
      };
    }
    return null;
  }

  private normalizeKey(value: string) {
    return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '_');
  }

  private normalizeEventType(value: string) {
    return value.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_');
  }

  private isRetryableTransaction(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }

  private isUniqueConflict(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
