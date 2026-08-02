import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConceptKAssetsService } from './concept-k-assets.service';
import {
  RecordConceptKAssetDeliveryDto,
  RestoreConceptKAssetDto
} from './dto/concept-k-delivery.dto';

const HEALTH_WINDOW_HOURS = 24;
const MINIMUM_SAMPLES = 5;
const MINIMUM_FAILURES = 4;
const FAILURE_RATE_THRESHOLD = 0.8;
const FAILURE_OUTCOMES = ['LOAD_FAILED', 'INTEGRITY_FAILED'];

@Injectable()
export class ConceptKDeliveryHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: ConceptKAssetsService,
    private readonly audit: AuditService
  ) {}

  async record(userId: string, dto: RecordConceptKAssetDeliveryDto) {
    const asset = await this.prisma.conceptKAssetManifest.findUnique({
      where: { id: dto.assetId },
      include: { character: true }
    });
    if (!asset) throw new NotFoundException('Asset Concept K introuvable.');
    if (!asset.active || asset.quarantinedAt) {
      throw new BadRequestException('Cet asset n’est plus distribuable.');
    }
    if (
      dto.outcome === 'INTEGRITY_FAILED' &&
      (!dto.observedSha256 || dto.observedSha256 === asset.sha256)
    ) {
      throw new BadRequestException(
        'Un échec d’intégrité exige un hash observé différent du manifeste.'
      );
    }

    const resolved = await this.assets.resolve(userId, {
      eventKey: asset.eventKey,
      clientReducedMotion: asset.variant === 'REDUCED',
      deviceClass: dto.deviceClass,
      platform: dto.platform
    });
    if (!resolved.asset || resolved.asset.id !== asset.id) {
      throw new ForbiddenException(
        'Ce compte n’était pas éligible à cet asset pour ce contexte.'
      );
    }

    const sampleDate = this.utcDay(new Date());
    const idempotencyKey = `concept-k-delivery:${userId}:${dto.clientEventId}`;
    const existing = await this.prisma.conceptKAssetDeliveryEvent.findFirst({
      where: {
        OR: [
          { idempotencyKey },
          { userId, assetId: asset.id, sampleDate }
        ]
      }
    });
    if (existing) {
      return {
        event: existing,
        replayed: true,
        health: await this.healthForAsset(asset.id),
        quarantinedNow: false
      };
    }

    let event;
    try {
      event = await this.prisma.conceptKAssetDeliveryEvent.create({
        data: {
          userId,
          assetId: asset.id,
          sampleDate,
          outcome: dto.outcome,
          durationMs: dto.durationMs,
          platform: dto.platform,
          deviceClass: dto.deviceClass,
          observedSha256: dto.observedSha256 ?? null,
          idempotencyKey
        }
      });
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        const replay = await this.prisma.conceptKAssetDeliveryEvent.findFirst({
          where: {
            OR: [
              { idempotencyKey },
              { userId, assetId: asset.id, sampleDate }
            ]
          }
        });
        if (replay) {
          return {
            event: replay,
            replayed: true,
            health: await this.healthForAsset(asset.id),
            quarantinedNow: false
          };
        }
      }
      throw error;
    }

    const health = await this.healthForAsset(asset.id);
    let quarantinedNow = false;
    if (this.shouldQuarantine(health.totalSamples, health.failureSamples)) {
      const quarantinedAt = new Date();
      const update = await this.prisma.conceptKAssetManifest.updateMany({
        where: { id: asset.id, quarantinedAt: null, active: true },
        data: {
          active: false,
          quarantinedAt,
          quarantineReason: `HEALTH_GATE:${health.failureSamples}/${health.totalSamples}`,
          quarantineSource: 'AUTOMATIC_HEALTH_GATE',
          restoredAt: null,
          restoredById: null
        }
      });
      quarantinedNow = update.count === 1;
      if (quarantinedNow) {
        await this.audit.record({
          action: 'CONCEPT_K_ASSET_AUTO_QUARANTINED',
          entity: 'ConceptKAssetManifest',
          entityId: asset.id,
          metadata: {
            totalSamples: health.totalSamples,
            failureSamples: health.failureSamples,
            failureRate: health.failureRate,
            windowHours: HEALTH_WINDOW_HOURS,
            threshold: FAILURE_RATE_THRESHOLD
          }
        });
      }
    }

    return { event, replayed: false, health, quarantinedNow };
  }

  async adminHealth() {
    const assets = await this.prisma.conceptKAssetManifest.findMany({
      include: { character: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }]
    });
    return {
      items: await Promise.all(
        assets.map(async (asset) => ({
          asset: {
            id: asset.id,
            key: asset.key,
            version: asset.version,
            eventKey: asset.eventKey,
            active: asset.active,
            quarantinedAt: asset.quarantinedAt,
            quarantineReason: asset.quarantineReason,
            quarantineSource: asset.quarantineSource,
            restoredAt: asset.restoredAt,
            character: {
              key: asset.character.key,
              displayName: asset.character.displayName
            }
          },
          health: await this.healthForAsset(asset.id)
        }))
      ),
      policy: this.policy()
    };
  }

  async restore(actorId: string, assetId: string, dto: RestoreConceptKAssetDto) {
    const asset = await this.prisma.conceptKAssetManifest.findUnique({
      where: { id: assetId }
    });
    if (!asset) throw new NotFoundException('Asset Concept K introuvable.');
    if (!asset.quarantinedAt) {
      return { asset, replayed: true };
    }

    const restored = await this.prisma.conceptKAssetManifest.update({
      where: { id: assetId },
      data: {
        active: true,
        quarantinedAt: null,
        quarantineReason: null,
        quarantineSource: null,
        restoredAt: new Date(),
        restoredById: actorId,
        reason: dto.reason.trim()
      }
    });
    await this.audit.record({
      actorId,
      action: 'CONCEPT_K_ASSET_RESTORED',
      entity: 'ConceptKAssetManifest',
      entityId: assetId,
      metadata: {
        previousQuarantinedAt: asset.quarantinedAt,
        previousReason: asset.quarantineReason,
        reason: dto.reason.trim()
      }
    });
    return { asset: restored, replayed: false };
  }

  async exportForAccount(userId: string) {
    return this.prisma.conceptKAssetDeliveryEvent.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });
  }

  async deleteForAccount(userId: string, tx: Prisma.TransactionClient) {
    await tx.conceptKAssetDeliveryEvent.deleteMany({ where: { userId } });
  }

  async healthForAsset(assetId: string) {
    const since = new Date(Date.now() - HEALTH_WINDOW_HOURS * 60 * 60 * 1000);
    const samples = await this.prisma.conceptKAssetDeliveryEvent.findMany({
      where: { assetId, createdAt: { gte: since } },
      select: { outcome: true, durationMs: true }
    });
    const failureSamples = samples.filter((sample) =>
      FAILURE_OUTCOMES.includes(sample.outcome)
    ).length;
    const totalDuration = samples.reduce((sum, sample) => sum + sample.durationMs, 0);
    return {
      totalSamples: samples.length,
      failureSamples,
      successSamples: samples.length - failureSamples,
      failureRate: samples.length ? failureSamples / samples.length : 0,
      averageDurationMs: samples.length ? Math.round(totalDuration / samples.length) : 0,
      windowHours: HEALTH_WINDOW_HOURS
    };
  }

  shouldQuarantine(totalSamples: number, failureSamples: number) {
    return (
      totalSamples >= MINIMUM_SAMPLES &&
      failureSamples >= MINIMUM_FAILURES &&
      failureSamples / totalSamples >= FAILURE_RATE_THRESHOLD
    );
  }

  utcDay(value: Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  policy() {
    return {
      healthWindowHours: HEALTH_WINDOW_HOURS,
      minimumSamples: MINIMUM_SAMPLES,
      minimumFailures: MINIMUM_FAILURES,
      failureRateThreshold: FAILURE_RATE_THRESHOLD,
      oneSamplePerAccountAssetDay: true,
      automaticFallback: true,
      premiumBypassAllowed: false
    };
  }

  private isUniqueConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
