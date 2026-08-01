import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { createHash } from 'crypto';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDataSubjectRequestDto,
  PublishPrivacyPolicyDto,
  RecordConsentDto,
  UpdatePrivacyPreferencesDto,
  UpsertRetentionPolicyDto
} from './dto/privacy.dto';

export type PrivacyEvidenceContext = {
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class PrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async center(userId: string, locale = 'fr') {
    const [policies, events, preferences, requests] = await Promise.all([
      this.currentPolicies(locale),
      this.prisma.privacyConsentEvent.findMany({
        where: { userId },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }]
      }),
      this.getPreferences(userId),
      this.prisma.dataSubjectRequest.findMany({
        where: { userId },
        orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
        take: 50
      })
    ]);

    const latestByPolicy = new Map<string, (typeof events)[number]>();
    for (const event of events) {
      if (!latestByPolicy.has(event.policyKey)) {
        latestByPolicy.set(event.policyKey, event);
      }
    }

    return {
      policies: policies.map((policy) => {
        const latest = latestByPolicy.get(policy.key);
        return {
          ...policy,
          granted:
            latest?.action === 'GRANT' &&
            latest.policyVersion === policy.version,
          lastAction: latest?.action ?? null,
          lastActionAt: latest?.occurredAt ?? null,
          needsRenewal:
            !latest ||
            latest.action !== 'GRANT' ||
            latest.policyVersion !== policy.version
        };
      }),
      preferences,
      requests,
      consentHistory: events.map(({ evidenceHash, ipHash, userAgentHash, ...event }) => event)
    };
  }

  async currentPolicies(locale = 'fr') {
    const now = new Date();
    const policies = await this.prisma.privacyPolicyVersion.findMany({
      where: {
        locale,
        effectiveAt: { lte: now },
        OR: [{ retiredAt: null }, { retiredAt: { gt: now } }]
      },
      orderBy: [{ key: 'asc' }, { version: 'desc' }]
    });

    const latest = new Map<string, (typeof policies)[number]>();
    for (const policy of policies) {
      if (!latest.has(policy.key)) latest.set(policy.key, policy);
    }
    return [...latest.values()];
  }

  async recordConsent(
    userId: string,
    dto: RecordConsentDto,
    context: PrivacyEvidenceContext
  ) {
    const locale = dto.locale ?? 'fr';
    const policy = await this.prisma.privacyPolicyVersion.findUnique({
      where: {
        key_version_locale: {
          key: dto.policyKey,
          version: dto.policyVersion,
          locale
        }
      }
    });
    if (!policy || policy.effectiveAt > new Date() || policy.retiredAt) {
      throw new NotFoundException('Version de politique indisponible.');
    }
    if (dto.action === 'WITHDRAW' && policy.required) {
      throw new ConflictException(
        'Cette politique est nécessaire au fonctionnement du service. La suppression du compte reste disponible.'
      );
    }

    const existing = await this.prisma.privacyConsentEvent.findUnique({
      where: { idempotencyKey: dto.idempotencyKey }
    });
    if (existing) {
      if (
        existing.userId !== userId ||
        existing.policyKey !== dto.policyKey ||
        existing.policyVersion !== dto.policyVersion ||
        existing.action !== dto.action
      ) {
        throw new ConflictException('Clé d’idempotence déjà utilisée pour une autre décision.');
      }
      return this.publicConsent(existing);
    }

    const occurredAt = new Date();
    const evidenceHash = this.hash(
      [
        userId,
        dto.policyKey,
        dto.policyVersion,
        dto.action,
        dto.source,
        occurredAt.toISOString(),
        policy.contentHash
      ].join('|')
    );

    const event = await this.prisma.privacyConsentEvent.create({
      data: {
        userId,
        policyKey: dto.policyKey,
        policyVersion: dto.policyVersion,
        locale,
        action: dto.action,
        legalBasis: policy.required ? 'CONTRACT' : 'CONSENT',
        source: dto.source,
        idempotencyKey: dto.idempotencyKey,
        evidenceHash,
        ipHash: this.optionalHash(context.ipAddress),
        userAgentHash: this.optionalHash(context.userAgent),
        occurredAt,
        metadata: { contentHash: policy.contentHash }
      }
    });

    await this.audit.record({
      actorId: userId,
      action: `PRIVACY_CONSENT_${dto.action}`,
      entity: 'PrivacyPolicyVersion',
      entityId: policy.id,
      targetAccountId: userId,
      metadata: {
        policyKey: dto.policyKey,
        policyVersion: dto.policyVersion,
        source: dto.source
      }
    });
    return this.publicConsent(event);
  }

  async getPreferences(userId: string) {
    return this.prisma.privacyPreference.upsert({
      where: { userId },
      create: { userId },
      update: {}
    });
  }

  async updatePreferences(userId: string, dto: UpdatePrivacyPreferencesDto) {
    if (!Object.keys(dto).length) {
      throw new BadRequestException('Aucune préférence fournie.');
    }
    const preference = await this.prisma.privacyPreference.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: { ...dto, version: { increment: 1 } }
    });
    await this.audit.record({
      actorId: userId,
      action: 'PRIVACY_PREFERENCES_UPDATE',
      entity: 'PrivacyPreference',
      entityId: userId,
      targetAccountId: userId,
      metadata: { fields: Object.keys(dto) }
    });
    return preference;
  }

  async createRequest(userId: string, dto: CreateDataSubjectRequestDto) {
    const existing = await this.prisma.dataSubjectRequest.findUnique({
      where: { idempotencyKey: dto.idempotencyKey }
    });
    if (existing) {
      if (existing.userId !== userId || existing.type !== dto.type) {
        throw new ConflictException('Clé d’idempotence déjà utilisée.');
      }
      return existing;
    }

    const open = await this.prisma.dataSubjectRequest.findFirst({
      where: {
        userId,
        type: dto.type,
        status: { in: ['PENDING', 'PROCESSING'] }
      }
    });
    if (open) return open;

    const request = await this.prisma.dataSubjectRequest.create({
      data: {
        userId,
        type: dto.type,
        idempotencyKey: dto.idempotencyKey,
        reason: dto.reason?.trim() || null,
        dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
    await this.audit.record({
      actorId: userId,
      action: 'DATA_SUBJECT_REQUEST_CREATE',
      entity: 'DataSubjectRequest',
      entityId: request.id,
      targetAccountId: userId,
      metadata: { type: dto.type }
    });
    return request;
  }

  async cancelRequest(userId: string, requestId: string) {
    const result = await this.prisma.dataSubjectRequest.updateMany({
      where: { id: requestId, userId, status: 'PENDING' },
      data: { status: 'CANCELLED', cancelledAt: new Date() }
    });
    if (!result.count) {
      throw new NotFoundException('Demande annulable introuvable.');
    }
    await this.audit.record({
      actorId: userId,
      action: 'DATA_SUBJECT_REQUEST_CANCEL',
      entity: 'DataSubjectRequest',
      entityId: requestId,
      targetAccountId: userId
    });
    return { cancelled: true };
  }

  async publishPolicy(actorId: string, dto: PublishPrivacyPolicyDto) {
    const effectiveAt = new Date(dto.effectiveAt);
    if (Number.isNaN(effectiveAt.getTime())) {
      throw new BadRequestException('Date d’entrée en vigueur invalide.');
    }
    const policy = await this.prisma.privacyPolicyVersion.create({
      data: {
        key: dto.key,
        version: dto.version,
        locale: dto.locale,
        title: dto.title.trim(),
        summary: dto.summary.trim(),
        contentHash: dto.contentHash.toLowerCase(),
        required: dto.required,
        effectiveAt,
        createdById: actorId
      }
    });
    await this.audit.record({
      actorId,
      action: 'PRIVACY_POLICY_PUBLISH',
      entity: 'PrivacyPolicyVersion',
      entityId: policy.id,
      metadata: { key: policy.key, version: policy.version, locale: policy.locale }
    });
    return policy;
  }

  listPoliciesForAdmin() {
    return this.prisma.privacyPolicyVersion.findMany({
      orderBy: [{ key: 'asc' }, { locale: 'asc' }, { version: 'desc' }]
    });
  }

  async upsertRetentionPolicy(actorId: string, dto: UpsertRetentionPolicyDto) {
    const policy = await this.prisma.dataRetentionPolicy.upsert({
      where: { key: dto.key },
      create: { ...dto, createdById: actorId },
      update: { ...dto, createdById: actorId }
    });
    await this.audit.record({
      actorId,
      action: 'RETENTION_POLICY_UPSERT',
      entity: 'DataRetentionPolicy',
      entityId: policy.id,
      metadata: {
        key: policy.key,
        resourceType: policy.resourceType,
        retentionDays: policy.retentionDays,
        action: policy.action
      }
    });
    return policy;
  }

  listRetentionPolicies() {
    return this.prisma.dataRetentionPolicy.findMany({
      orderBy: [{ enabled: 'desc' }, { key: 'asc' }]
    });
  }

  async executeRetention(actorId: string, policyId: string) {
    const policy = await this.prisma.dataRetentionPolicy.findUnique({
      where: { id: policyId }
    });
    if (!policy || !policy.enabled) {
      throw new NotFoundException('Politique de conservation active introuvable.');
    }
    const cutoffAt = new Date(
      Date.now() - (policy.retentionDays + policy.gracePeriodDays) * 86_400_000
    );
    const execution = await this.prisma.dataRetentionExecution.create({
      data: { policyId, cutoffAt }
    });

    try {
      const affected = await this.applyRetention(policy.resourceType, policy.action, cutoffAt);
      const completed = await this.prisma.dataRetentionExecution.update({
        where: { id: execution.id },
        data: {
          status: 'COMPLETED',
          scannedCount: affected,
          deletedCount: policy.action === 'DELETE' ? affected : 0,
          anonymizedCount: policy.action === 'ANONYMIZE' ? affected : 0,
          completedAt: new Date()
        }
      });
      await this.audit.record({
        actorId,
        action: 'RETENTION_EXECUTE',
        entity: 'DataRetentionPolicy',
        entityId: policy.id,
        metadata: { executionId: execution.id, affected, cutoffAt: cutoffAt.toISOString() }
      });
      return completed;
    } catch (error) {
      await this.prisma.dataRetentionExecution.update({
        where: { id: execution.id },
        data: { status: 'FAILED', errorCount: 1, completedAt: new Date() }
      });
      throw error;
    }
  }

  async exportForAccount(userId: string) {
    const [preferences, consentEvents, requests] = await Promise.all([
      this.prisma.privacyPreference.findUnique({ where: { userId } }),
      this.prisma.privacyConsentEvent.findMany({
        where: { userId },
        orderBy: { occurredAt: 'asc' },
        select: {
          id: true,
          policyKey: true,
          policyVersion: true,
          locale: true,
          action: true,
          legalBasis: true,
          source: true,
          occurredAt: true,
          metadata: true
        }
      }),
      this.prisma.dataSubjectRequest.findMany({
        where: { userId },
        orderBy: { requestedAt: 'asc' }
      })
    ]);
    return { preferences, consentEvents, requests };
  }

  async cleanupAccount(userId: string) {
    await this.prisma.$transaction([
      this.prisma.privacyConsentEvent.deleteMany({ where: { userId } }),
      this.prisma.privacyPreference.deleteMany({ where: { userId } }),
      this.prisma.dataSubjectRequest.deleteMany({ where: { userId } })
    ]);
  }

  private async applyRetention(resourceType: string, action: string, cutoffAt: Date) {
    if (action !== 'DELETE') {
      throw new BadRequestException(
        'L’anonymisation automatique n’est pas encore autorisée pour ce type de ressource.'
      );
    }
    switch (resourceType) {
      case 'SECURITY_CHALLENGE':
        return (
          await this.prisma.securityChallenge.deleteMany({
            where: { expiresAt: { lt: cutoffAt } }
          })
        ).count;
      case 'REAUTHENTICATION_PROOF':
        return (
          await this.prisma.reauthenticationProof.deleteMany({
            where: { expiresAt: { lt: cutoffAt } }
          })
        ).count;
      case 'AUTH_SESSION':
        return (
          await this.prisma.authSession.deleteMany({
            where: {
              OR: [
                { expiresAt: { lt: cutoffAt } },
                { revokedAt: { lt: cutoffAt } }
              ]
            }
          })
        ).count;
      case 'READ_NOTIFICATION':
        return (
          await this.prisma.notification.deleteMany({
            where: { readAt: { lt: cutoffAt } }
          })
        ).count;
      default:
        throw new BadRequestException('Type de ressource non pris en charge.');
    }
  }

  private publicConsent<T extends { evidenceHash: string; ipHash: string | null; userAgentHash: string | null }>(event: T) {
    const { evidenceHash, ipHash, userAgentHash, ...safe } = event;
    return safe;
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private optionalHash(value?: string) {
    return value ? this.hash(value.slice(0, 1000)) : null;
  }
}
