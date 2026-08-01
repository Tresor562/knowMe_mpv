import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { FeatureFlag, FeatureFlagRule } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateFeatureFlagDto,
  CreateFeatureFlagRuleDto,
  SetFeatureFlagOverrideDto,
  UpdateFeatureFlagDto
} from './dto/feature-flag.dto';

type FlagWithRules = FeatureFlag & { rules: FeatureFlagRule[] };

export type FeatureFlagContext = {
  userId: string;
  platform?: string;
  country?: string;
  version?: string;
  audience?: string;
};

type CachedFlag = {
  value: FlagWithRules | null;
  expiresAt: number;
};

@Injectable()
export class FeatureFlagsService {
  private readonly cache = new Map<string, CachedFlag>();
  private readonly cacheTtlMs = 15_000;

  constructor(private readonly prisma: PrismaService) {}

  async listAdmin() {
    return this.prisma.featureFlag.findMany({
      include: {
        rules: { orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }] },
        overrides: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true
              }
            }
          },
          orderBy: { updatedAt: 'desc' },
          take: 100
        }
      },
      orderBy: { key: 'asc' }
    });
  }

  async clientFlags(context: FeatureFlagContext, requestedKeys?: string[]) {
    const normalizedKeys = requestedKeys
      ?.map((key) => this.normalizeKey(key))
      .filter(Boolean)
      .slice(0, 100);
    const now = new Date();

    const flags = await this.prisma.featureFlag.findMany({
      where: {
        exposeToClient: true,
        ...(normalizedKeys?.length ? { key: { in: normalizedKeys } } : {})
      },
      include: {
        rules: { orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }] },
        overrides: {
          where: {
            userId: context.userId,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
          },
          take: 1
        }
      },
      orderBy: { key: 'asc' }
    });

    return Object.fromEntries(
      flags.map((flag) => [
        flag.key,
        this.evaluateLoadedFlag(flag, context, flag.overrides[0]?.enabled)
      ])
    );
  }

  async evaluate(key: string, context: FeatureFlagContext) {
    const normalizedKey = this.normalizeKey(key);
    const flag = await this.getCachedFlag(normalizedKey);
    if (!flag) return false;

    const override = await this.prisma.featureFlagOverride.findUnique({
      where: {
        flagId_userId: {
          flagId: flag.id,
          userId: context.userId
        }
      },
      select: { enabled: true, expiresAt: true }
    });

    const activeOverride =
      override &&
      (!override.expiresAt || override.expiresAt.getTime() > Date.now())
        ? override.enabled
        : undefined;

    return this.evaluateLoadedFlag(flag, context, activeOverride);
  }

  async create(actorId: string, dto: CreateFeatureFlagDto) {
    const key = this.normalizeKey(dto.key);
    const existing = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (existing) throw new ConflictException('Ce feature flag existe déjà.');

    const flag = await this.prisma.featureFlag.create({
      data: {
        key,
        description: dto.description?.trim() || null,
        enabled: dto.enabled ?? false,
        exposeToClient: dto.exposeToClient ?? false,
        riskLevel: dto.riskLevel ?? 'NORMAL',
        owner: dto.owner?.trim() || null,
        reviewAt: dto.reviewAt ? new Date(dto.reviewAt) : null
      }
    });

    await this.audit(actorId, 'FEATURE_FLAG_CREATE', flag.id, {
      key: flag.key,
      enabled: flag.enabled,
      exposeToClient: flag.exposeToClient
    });
    this.invalidate(key);
    return flag;
  }

  async update(actorId: string, key: string, dto: UpdateFeatureFlagDto) {
    const flag = await this.requireFlag(key);
    const updated = await this.prisma.featureFlag.update({
      where: { id: flag.id },
      data: {
        ...(dto.description !== undefined
          ? { description: dto.description.trim() || null }
          : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.exposeToClient !== undefined
          ? { exposeToClient: dto.exposeToClient }
          : {}),
        ...(dto.riskLevel !== undefined ? { riskLevel: dto.riskLevel } : {}),
        ...(dto.owner !== undefined ? { owner: dto.owner.trim() || null } : {}),
        ...(dto.reviewAt !== undefined
          ? { reviewAt: dto.reviewAt ? new Date(dto.reviewAt) : null }
          : {})
      }
    });

    await this.audit(actorId, 'FEATURE_FLAG_UPDATE', flag.id, {
      key: flag.key,
      changes: this.compactObject(dto)
    });
    this.invalidate(flag.key);
    return updated;
  }

  async addRule(
    actorId: string,
    key: string,
    dto: CreateFeatureFlagRuleDto
  ) {
    const flag = await this.requireFlag(key);
    const count = await this.prisma.featureFlagRule.count({
      where: { flagId: flag.id }
    });
    if (count >= 100) {
      throw new BadRequestException('Ce flag possède déjà trop de règles.');
    }

    const rule = await this.prisma.featureFlagRule.create({
      data: {
        flagId: flag.id,
        enabled: dto.enabled,
        platform: dto.platform?.trim().toLowerCase() || null,
        country: dto.country?.trim().toUpperCase() || null,
        minVersion: dto.minVersion?.trim() || null,
        rolloutPercentage: dto.rolloutPercentage ?? null,
        audience: dto.audience?.trim() || null,
        priority: dto.priority ?? 0
      }
    });

    await this.audit(actorId, 'FEATURE_FLAG_RULE_CREATE', rule.id, {
      flagId: flag.id,
      key: flag.key
    });
    this.invalidate(flag.key);
    return rule;
  }

  async removeRule(actorId: string, key: string, ruleId: string) {
    const flag = await this.requireFlag(key);
    const rule = await this.prisma.featureFlagRule.findFirst({
      where: { id: ruleId, flagId: flag.id }
    });
    if (!rule) throw new NotFoundException('Règle introuvable.');

    await this.prisma.featureFlagRule.delete({ where: { id: rule.id } });
    await this.audit(actorId, 'FEATURE_FLAG_RULE_DELETE', rule.id, {
      flagId: flag.id,
      key: flag.key
    });
    this.invalidate(flag.key);
    return { deleted: true };
  }

  async setOverride(
    actorId: string,
    key: string,
    userId: string,
    dto: SetFeatureFlagOverrideDto
  ) {
    const [flag, user] = await Promise.all([
      this.requireFlag(key),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true }
      })
    ]);
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('La date d’expiration doit être future.');
    }

    const override = await this.prisma.featureFlagOverride.upsert({
      where: { flagId_userId: { flagId: flag.id, userId } },
      create: { flagId: flag.id, userId, enabled: dto.enabled, expiresAt },
      update: { enabled: dto.enabled, expiresAt }
    });

    await this.audit(actorId, 'FEATURE_FLAG_OVERRIDE_SET', override.id, {
      flagId: flag.id,
      key: flag.key,
      userId,
      enabled: dto.enabled,
      expiresAt: expiresAt?.toISOString() ?? null
    });
    return override;
  }

  async removeOverride(actorId: string, key: string, userId: string) {
    const flag = await this.requireFlag(key);
    const override = await this.prisma.featureFlagOverride.findUnique({
      where: { flagId_userId: { flagId: flag.id, userId } }
    });
    if (!override) throw new NotFoundException('Override introuvable.');

    await this.prisma.featureFlagOverride.delete({ where: { id: override.id } });
    await this.audit(actorId, 'FEATURE_FLAG_OVERRIDE_DELETE', override.id, {
      flagId: flag.id,
      key: flag.key,
      userId
    });
    return { deleted: true };
  }

  private evaluateLoadedFlag(
    flag: FlagWithRules,
    context: FeatureFlagContext,
    override?: boolean
  ) {
    if (!flag.enabled) return false;
    if (override !== undefined) return override;

    for (const rule of flag.rules) {
      if (this.ruleMatches(flag.key, rule, context)) return rule.enabled;
    }

    return true;
  }

  private ruleMatches(
    flagKey: string,
    rule: FeatureFlagRule,
    context: FeatureFlagContext
  ) {
    if (
      rule.platform &&
      rule.platform.toLowerCase() !== context.platform?.toLowerCase()
    ) {
      return false;
    }

    if (
      rule.country &&
      rule.country.toUpperCase() !== context.country?.toUpperCase()
    ) {
      return false;
    }

    if (rule.audience && rule.audience !== context.audience) return false;

    if (
      rule.minVersion &&
      (!context.version ||
        this.compareVersions(context.version, rule.minVersion) < 0)
    ) {
      return false;
    }

    if (rule.rolloutPercentage !== null) {
      const bucket = this.stableBucket(`${flagKey}:${context.userId}`);
      if (bucket >= rule.rolloutPercentage) return false;
    }

    return true;
  }

  private compareVersions(left: string, right: string) {
    const a = left.split('.').map((part) => Number.parseInt(part, 10) || 0);
    const b = right.split('.').map((part) => Number.parseInt(part, 10) || 0);
    const length = Math.max(a.length, b.length);

    for (let index = 0; index < length; index += 1) {
      const difference = (a[index] ?? 0) - (b[index] ?? 0);
      if (difference !== 0) return difference > 0 ? 1 : -1;
    }
    return 0;
  }

  private stableBucket(value: string) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % 100;
  }

  private async requireFlag(key: string) {
    const normalizedKey = this.normalizeKey(key);
    const flag = await this.prisma.featureFlag.findUnique({
      where: { key: normalizedKey }
    });
    if (!flag) throw new NotFoundException('Feature flag introuvable.');
    return flag;
  }

  private async getCachedFlag(key: string): Promise<FlagWithRules | null> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const value = await this.prisma.featureFlag.findUnique({
      where: { key },
      include: {
        rules: { orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }] }
      }
    });
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.cacheTtlMs
    });
    return value;
  }

  private invalidate(key?: string) {
    if (key) this.cache.delete(this.normalizeKey(key));
    else this.cache.clear();
  }

  private normalizeKey(key: string) {
    return key.trim().toLowerCase();
  }

  private compactObject(value: object) {
    return Object.fromEntries(
      Object.entries(value).filter(([, entry]) => entry !== undefined)
    );
  }

  private audit(
    actorId: string,
    action: string,
    entityId: string,
    metadata: Record<string, unknown>
  ) {
    return this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity: 'FeatureFlag',
        entityId,
        metadata: JSON.parse(JSON.stringify(metadata))
      }
    });
  }
}
