import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ANIMATION_CATALOG_VERSION,
  ANIMATION_EVENTS,
  AnimationPreferenceMode,
  DeviceClass,
  findAnimationEvent,
  resolveAnimationPlan
} from '@knowme/animation-contract';
import { Prisma } from '@prisma/client';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  RecordAnimationTelemetryDto,
  ResolveAnimationDto,
  UpdateAnimationPreferenceDto
} from './dto/concept-k.dto';

const TELEMETRY_RETENTION_DAYS = 30;

@Injectable()
export class ConceptKService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  catalog() {
    return {
      version: ANIMATION_CATALOG_VERSION,
      events: ANIMATION_EVENTS,
      rules: {
        loadStrategy: 'LAZY',
        blocking: false,
        skippable: true,
        staticFallbackRequired: true,
        supportedModes: ['AUTO', 'REDUCED', 'OFF'],
        telemetryRetentionDays: TELEMETRY_RETENTION_DAYS,
        contentCaptured: false
      }
    };
  }

  async preference(userId: string) {
    return this.prisma.userAnimationPreference.upsert({
      where: { userId },
      create: { userId },
      update: {}
    });
  }

  async updatePreference(userId: string, dto: UpdateAnimationPreferenceDto) {
    const preference = await this.prisma.userAnimationPreference.upsert({
      where: { userId },
      create: {
        userId,
        mode: dto.mode,
        soundEnabled: dto.soundEnabled,
        hapticsEnabled: dto.hapticsEnabled
      },
      update: {
        mode: dto.mode,
        soundEnabled: dto.soundEnabled,
        hapticsEnabled: dto.hapticsEnabled
      }
    });

    await this.audit.record({
      actorId: userId,
      action: 'ANIMATION_PREFERENCE_UPDATED',
      entity: 'UserAnimationPreference',
      entityId: userId,
      targetAccountId: userId,
      metadata: {
        mode: preference.mode,
        soundEnabled: preference.soundEnabled,
        hapticsEnabled: preference.hapticsEnabled
      }
    });

    return preference;
  }

  async resolve(userId: string, dto: ResolveAnimationDto) {
    const event = findAnimationEvent(dto.eventKey);
    if (!event) throw new NotFoundException('Événement Concept K inconnu.');
    const preference = await this.preference(userId);
    const plan = resolveAnimationPlan({
      eventKey: dto.eventKey,
      preferenceMode: preference.mode as AnimationPreferenceMode,
      clientReducedMotion: dto.clientReducedMotion,
      deviceClass: dto.deviceClass as DeviceClass,
      soundEnabled: preference.soundEnabled,
      hapticsEnabled: preference.hapticsEnabled
    });
    if (!plan) throw new NotFoundException('Événement Concept K inconnu.');
    return {
      preference,
      plan,
      serverTime: new Date()
    };
  }

  async recordTelemetry(userId: string, dto: RecordAnimationTelemetryDto) {
    const resolved = await this.resolve(userId, dto);
    const idempotencyKey = `concept-k:${userId}:${dto.clientEventId}`;
    const existing = await this.prisma.animationTelemetryEvent.findUnique({
      where: { idempotencyKey }
    });
    if (existing) return { event: existing, replayed: true };

    const eventDefinition = resolved.plan.event;
    const reason = this.telemetryReason(dto, resolved.plan.reason, eventDefinition.maxDurationMs);

    try {
      const event = await this.prisma.animationTelemetryEvent.create({
        data: {
          userId,
          eventKey: dto.eventKey,
          catalogVersion: resolved.plan.catalogVersion,
          preferenceMode: resolved.preference.mode,
          variant: resolved.plan.variant,
          outcome: dto.outcome,
          durationMs: dto.durationMs,
          assetBytes: dto.assetBytes,
          platform: dto.platform,
          deviceClass: dto.deviceClass,
          reason,
          idempotencyKey
        }
      });
      return { event, replayed: false };
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        const replay = await this.prisma.animationTelemetryEvent.findUnique({
          where: { idempotencyKey }
        });
        if (replay) return { event: replay, replayed: true };
      }
      throw error;
    }
  }

  async exportForAccount(userId: string) {
    const [preference, telemetry] = await Promise.all([
      this.prisma.userAnimationPreference.findUnique({ where: { userId } }),
      this.prisma.animationTelemetryEvent.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
      })
    ]);
    return { preference, telemetry, catalogVersion: ANIMATION_CATALOG_VERSION };
  }

  async deleteForAccount(userId: string, tx: Prisma.TransactionClient) {
    await tx.animationTelemetryEvent.deleteMany({ where: { userId } });
    await tx.userAnimationPreference.deleteMany({ where: { userId } });
  }

  async pruneTelemetry(now = new Date()) {
    const cutoff = new Date(now.getTime() - TELEMETRY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    return this.prisma.animationTelemetryEvent.deleteMany({
      where: { createdAt: { lt: cutoff } }
    });
  }

  private telemetryReason(
    dto: RecordAnimationTelemetryDto,
    planReason: string,
    maximumDurationMs: number
  ) {
    if (dto.outcome === 'ERROR') {
      const code = dto.errorCode?.trim().replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 64);
      return code ? `CLIENT_ERROR:${code}` : 'CLIENT_ERROR';
    }
    if (dto.durationMs > maximumDurationMs * 2) return 'DURATION_OVER_BUDGET';
    if (dto.assetBytes > 1_000_000) return 'ASSET_OVER_BUDGET';
    return planReason;
  }

  private isUniqueConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
