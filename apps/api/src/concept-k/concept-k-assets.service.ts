import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { findAnimationEvent } from '@knowme/animation-contract';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConceptKService } from './concept-k.service';
import {
  CreateConceptKAssetDto,
  CreateConceptKCharacterDto,
  ResolveConceptKAssetDto,
  UpdateConceptKAssetRolloutDto
} from './dto/concept-k-assets.dto';

@Injectable()
export class ConceptKAssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conceptK: ConceptKService,
    private readonly audit: AuditService
  ) {}

  async publicCharacters() {
    const characters = await this.prisma.conceptKCharacterDefinition.findMany({
      where: { active: true },
      include: {
        assets: {
          where: { active: true },
          select: { id: true, eventKey: true, variant: true, platform: true, deviceClass: true }
        }
      },
      orderBy: [{ key: 'asc' }, { version: 'desc' }]
    });

    return {
      items: characters.map((character) => ({
        id: character.id,
        key: character.key,
        version: character.version,
        displayName: character.displayName,
        description: character.description,
        originalWork: character.originalWork,
        licenseKey: character.licenseKey,
        assets: character.assets
      })),
      rules: {
        originalCharactersOnly: true,
        integrityHashRequired: true,
        lazyDelivery: true,
        paidPriorityAllowed: false
      }
    };
  }

  adminCatalog() {
    return this.prisma.conceptKCharacterDefinition.findMany({
      include: { assets: { orderBy: [{ key: 'asc' }, { version: 'desc' }] } },
      orderBy: [{ key: 'asc' }, { version: 'desc' }]
    });
  }

  async createCharacter(actorId: string, dto: CreateConceptKCharacterDto) {
    try {
      const character = await this.prisma.conceptKCharacterDefinition.create({
        data: {
          key: dto.key,
          version: dto.version,
          displayName: dto.displayName.trim(),
          description: dto.description.trim(),
          originalWork: true,
          licenseKey: 'KNOWME_ORIGINAL',
          active: dto.active,
          createdById: actorId,
          reason: dto.reason.trim()
        }
      });
      await this.audit.record({
        actorId,
        action: 'CONCEPT_K_CHARACTER_CREATED',
        entity: 'ConceptKCharacterDefinition',
        entityId: character.id,
        metadata: {
          key: character.key,
          version: character.version,
          originalWork: true,
          licenseKey: character.licenseKey,
          active: character.active
        }
      });
      return character;
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        throw new ConflictException('Cette version de personnage existe déjà.');
      }
      throw error;
    }
  }

  async createAsset(actorId: string, dto: CreateConceptKAssetDto) {
    const event = findAnimationEvent(dto.eventKey);
    if (!event) throw new NotFoundException('Événement Concept K inconnu.');
    if (dto.variant === 'REDUCED' && !event.supportsReduced) {
      throw new BadRequestException('Cet événement ne possède pas de variante réduite.');
    }
    if (dto.durationMs > event.maxDurationMs) {
      throw new BadRequestException(
        `La durée dépasse le budget de ${event.maxDurationMs} ms.`
      );
    }

    const character = await this.prisma.conceptKCharacterDefinition.findUnique({
      where: { id: dto.characterId }
    });
    if (!character) throw new NotFoundException('Personnage Concept K introuvable.');
    if (!character.originalWork || character.licenseKey !== 'KNOWME_ORIGINAL') {
      throw new BadRequestException('Seuls les personnages originaux KnowMe sont autorisés.');
    }

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date();
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    this.assertWindow(startsAt, endsAt);

    try {
      const asset = await this.prisma.conceptKAssetManifest.create({
        data: {
          key: dto.key,
          version: dto.version,
          eventKey: dto.eventKey,
          characterId: dto.characterId,
          variant: dto.variant,
          platform: dto.platform,
          deviceClass: dto.deviceClass,
          publicUrl: dto.publicUrl,
          sha256: dto.sha256,
          bytes: dto.bytes,
          mimeType: dto.mimeType,
          durationMs: dto.durationMs,
          active: dto.active,
          rolloutPercentage: dto.rolloutPercentage,
          startsAt,
          endsAt,
          createdById: actorId,
          reason: dto.reason.trim()
        },
        include: { character: true }
      });
      await this.audit.record({
        actorId,
        action: 'CONCEPT_K_ASSET_CREATED',
        entity: 'ConceptKAssetManifest',
        entityId: asset.id,
        metadata: {
          key: asset.key,
          version: asset.version,
          eventKey: asset.eventKey,
          variant: asset.variant,
          platform: asset.platform,
          deviceClass: asset.deviceClass,
          bytes: asset.bytes,
          sha256: asset.sha256,
          rolloutPercentage: asset.rolloutPercentage
        }
      });
      return asset;
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        throw new ConflictException('Cette version d’asset existe déjà.');
      }
      throw error;
    }
  }

  async updateRollout(
    actorId: string,
    assetId: string,
    dto: UpdateConceptKAssetRolloutDto
  ) {
    const existing = await this.prisma.conceptKAssetManifest.findUnique({
      where: { id: assetId }
    });
    if (!existing) throw new NotFoundException('Asset Concept K introuvable.');

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : existing.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : existing.endsAt;
    this.assertWindow(startsAt, endsAt);

    const updated = await this.prisma.conceptKAssetManifest.update({
      where: { id: assetId },
      data: {
        active: dto.active,
        rolloutPercentage: dto.rolloutPercentage,
        startsAt,
        endsAt,
        reason: dto.reason.trim()
      },
      include: { character: true }
    });
    await this.audit.record({
      actorId,
      action: 'CONCEPT_K_ASSET_ROLLOUT_UPDATED',
      entity: 'ConceptKAssetManifest',
      entityId: assetId,
      metadata: {
        active: updated.active,
        rolloutPercentage: updated.rolloutPercentage,
        startsAt: updated.startsAt,
        endsAt: updated.endsAt,
        reason: dto.reason.trim()
      }
    });
    return updated;
  }

  async resolve(userId: string, dto: ResolveConceptKAssetDto) {
    const resolved = await this.conceptK.resolve(userId, {
      eventKey: dto.eventKey,
      clientReducedMotion: dto.clientReducedMotion,
      deviceClass: dto.deviceClass
    });

    if (resolved.plan.variant === 'STATIC') {
      return this.fallback(resolved, 'STATIC_PLAN');
    }

    const now = new Date();
    const candidates = await this.prisma.conceptKAssetManifest.findMany({
      where: {
        eventKey: dto.eventKey,
        variant: resolved.plan.variant,
        active: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        platform: { in: [dto.platform, 'ALL'] },
        deviceClass: { in: [dto.deviceClass, 'ALL'] }
      },
      include: { character: true }
    });

    const eligible = candidates
      .filter((candidate) => candidate.character.active)
      .filter(
        (candidate) =>
          candidate.rolloutPercentage > 0 &&
          this.deterministicBucket(userId, candidate.id) < candidate.rolloutPercentage
      )
      .sort((first, second) => {
        const score = (item: (typeof candidates)[number]) =>
          (item.platform === dto.platform ? 4 : 0) +
          (item.deviceClass === dto.deviceClass ? 2 : 0) +
          item.version / 100_000;
        return score(second) - score(first);
      });

    const asset = eligible[0];
    if (!asset) return this.fallback(resolved, 'NO_ELIGIBLE_ASSET');

    return {
      plan: resolved.plan,
      deliveryVariant: resolved.plan.variant,
      fallback: null,
      asset: {
        id: asset.id,
        key: asset.key,
        version: asset.version,
        eventKey: asset.eventKey,
        variant: asset.variant,
        platform: asset.platform,
        deviceClass: asset.deviceClass,
        publicUrl: asset.publicUrl,
        sha256: asset.sha256,
        bytes: asset.bytes,
        mimeType: asset.mimeType,
        durationMs: asset.durationMs,
        integrityAlgorithm: 'SHA-256',
        character: {
          key: asset.character.key,
          version: asset.character.version,
          displayName: asset.character.displayName,
          originalWork: asset.character.originalWork,
          licenseKey: asset.character.licenseKey
        }
      },
      rules: this.deliveryRules()
    };
  }

  deterministicBucket(userId: string, assetId: string) {
    const digest = createHash('sha256').update(`${userId}:${assetId}`).digest('hex');
    return Number.parseInt(digest.slice(0, 8), 16) % 100;
  }

  private fallback(resolved: Awaited<ReturnType<ConceptKService['resolve']>>, reason: string) {
    return {
      plan: resolved.plan,
      deliveryVariant: 'STATIC',
      asset: null,
      fallback: {
        symbol: resolved.plan.event.fallbackSymbol,
        label: resolved.plan.event.fallbackLabel,
        reason
      },
      rules: this.deliveryRules()
    };
  }

  private deliveryRules() {
    return {
      lazyDelivery: true,
      integrityRequired: true,
      integrityAlgorithm: 'SHA-256',
      maximumAssetBytes: 1_000_000,
      staticFallbackRequired: true,
      paidPriorityAllowed: false,
      clientCanOverrideRollout: false
    };
  }

  private assertWindow(startsAt: Date, endsAt: Date | null) {
    if (endsAt && endsAt <= startsAt) {
      throw new BadRequestException('La fin du rollout doit suivre son début.');
    }
  }

  private isUniqueConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
