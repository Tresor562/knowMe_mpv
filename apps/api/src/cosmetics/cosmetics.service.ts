import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  COSMETIC_SLOTS,
  CreateCosmeticDefinitionDto,
  GrantCosmeticDto
} from './dto/cosmetic.dto';

@Injectable()
export class CosmeticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  rules() {
    return {
      serverAuthoritative: true,
      purelyVisual: true,
      purchasesEnabled: false,
      premiumPowerAllowed: false,
      clientGrantedOwnershipAllowed: false,
      oneEquippedItemPerSlot: true
    };
  }

  listCatalog() {
    return this.prisma.cosmeticDefinition.findMany({
      orderBy: [{ key: 'asc' }, { version: 'desc' }]
    });
  }

  listGrants(userId?: string) {
    return this.prisma.cosmeticGrant.findMany({
      where: userId ? { userId } : undefined,
      include: { definition: true, equipment: true },
      orderBy: [{ grantedAt: 'desc' }, { id: 'desc' }]
    });
  }

  async createDefinition(actorId: string, dto: CreateCosmeticDefinitionDto) {
    const key = dto.key.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    if (!key) throw new BadRequestException('Clé cosmétique invalide.');
    if (dto.type !== dto.slot) {
      throw new BadRequestException(
        'Le type et le slot doivent correspondre dans ce premier catalogue unifié.'
      );
    }
    const definition = await this.prisma.cosmeticDefinition.create({
      data: {
        key,
        version: dto.version,
        type: dto.type,
        slot: dto.slot,
        name: dto.name.trim(),
        description: dto.description.trim(),
        assetUrl: dto.assetUrl?.trim() || null,
        rarity: dto.rarity ?? 'STANDARD',
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        active: dto.active ?? true,
        createdById: actorId,
        reason: dto.reason.trim()
      }
    });
    await this.audit.record({
      actorId,
      action: 'COSMETIC_DEFINITION_CREATED',
      entity: 'CosmeticDefinition',
      entityId: definition.id,
      metadata: {
        key: definition.key,
        version: definition.version,
        slot: definition.slot,
        purelyVisual: true
      }
    });
    return definition;
  }

  async grant(actorId: string, dto: GrantCosmeticDto) {
    const existing = await this.prisma.cosmeticGrant.findFirst({
      where: {
        OR: [
          { idempotencyKey: dto.idempotencyKey.trim() },
          { userId: dto.userId, definitionId: dto.definitionId }
        ]
      },
      include: { definition: true, equipment: true }
    });
    if (existing) return { grant: existing, replayed: true };

    const [definition, user] = await Promise.all([
      this.prisma.cosmeticDefinition.findUnique({ where: { id: dto.definitionId } }),
      this.prisma.user.findUnique({ where: { id: dto.userId }, select: { id: true } })
    ]);
    if (!definition || !definition.active) {
      throw new NotFoundException('Définition cosmétique active introuvable.');
    }
    if (!user) throw new NotFoundException('Compte destinataire introuvable.');

    const grant = await this.prisma.cosmeticGrant.create({
      data: {
        userId: dto.userId,
        definitionId: dto.definitionId,
        source: dto.source.trim(),
        reason: dto.reason.trim(),
        idempotencyKey: dto.idempotencyKey.trim(),
        metadata: dto.metadata as Prisma.InputJsonValue | undefined
      },
      include: { definition: true, equipment: true }
    });
    await this.audit.record({
      actorId,
      action: 'COSMETIC_GRANTED',
      entity: 'CosmeticGrant',
      entityId: grant.id,
      metadata: {
        userId: grant.userId,
        definitionId: grant.definitionId,
        source: grant.source,
        purchase: false
      }
    });
    return { grant, replayed: false };
  }

  async inventory(userId: string) {
    const [grants, equipment] = await Promise.all([
      this.prisma.cosmeticGrant.findMany({
        where: { userId },
        include: { definition: true, equipment: true },
        orderBy: [{ grantedAt: 'desc' }, { id: 'desc' }]
      }),
      this.prisma.cosmeticEquipment.findMany({
        where: { userId },
        include: { grant: { include: { definition: true } } },
        orderBy: [{ slot: 'asc' }]
      })
    ]);
    return {
      available: grants.filter((grant) => !grant.revokedAt && grant.definition.active),
      equipment,
      history: grants,
      rules: this.rules()
    };
  }

  async equip(userId: string, slot: string, grantId?: string | null) {
    this.assertSlot(slot);
    if (!grantId) {
      await this.prisma.cosmeticEquipment.deleteMany({ where: { userId, slot } });
      await this.audit.record({
        actorId: userId,
        action: 'COSMETIC_UNEQUIPPED',
        entity: 'CosmeticEquipment',
        entityId: `${userId}:${slot}`,
        metadata: { slot }
      });
      return this.inventory(userId);
    }

    const grant = await this.prisma.cosmeticGrant.findUnique({
      where: { id: grantId },
      include: { definition: true }
    });
    if (
      !grant ||
      grant.userId !== userId ||
      grant.revokedAt ||
      !grant.definition.active
    ) {
      throw new BadRequestException('Objet cosmétique non possédé ou indisponible.');
    }
    if (grant.definition.slot !== slot) {
      throw new BadRequestException('Cet objet ne peut pas être équipé dans ce slot.');
    }

    await this.prisma.cosmeticEquipment.upsert({
      where: { userId_slot: { userId, slot } },
      create: { userId, slot, grantId },
      update: { grantId, equippedAt: new Date() }
    });
    await this.audit.record({
      actorId: userId,
      action: 'COSMETIC_EQUIPPED',
      entity: 'CosmeticGrant',
      entityId: grant.id,
      metadata: { slot, definitionId: grant.definitionId }
    });
    return this.inventory(userId);
  }

  async revoke(actorId: string, grantId: string, reason: string) {
    const grant = await this.prisma.cosmeticGrant.findUnique({
      where: { id: grantId },
      include: { definition: true, equipment: true }
    });
    if (!grant) throw new NotFoundException('Attribution cosmétique introuvable.');
    if (grant.revokedAt) return { grant, replayed: true };

    const revokedAt = new Date();
    const revoked = await this.prisma.$transaction(async (tx) => {
      await tx.cosmeticEquipment.deleteMany({ where: { grantId } });
      return tx.cosmeticGrant.update({
        where: { id: grantId },
        data: {
          revokedAt,
          revokedById: actorId,
          revokeReason: reason.trim()
        },
        include: { definition: true, equipment: true }
      });
    });
    await this.audit.record({
      actorId,
      action: 'COSMETIC_GRANT_REVOKED',
      entity: 'CosmeticGrant',
      entityId: grantId,
      metadata: {
        userId: grant.userId,
        definitionId: grant.definitionId,
        reason: reason.trim(),
        equipmentRemoved: Boolean(grant.equipment)
      }
    });
    return { grant: revoked, replayed: false };
  }

  exportForAccount(userId: string) {
    return this.inventory(userId);
  }

  async deleteForAccount(userId: string, tx: Prisma.TransactionClient) {
    await tx.cosmeticEquipment.deleteMany({ where: { userId } });
    await tx.cosmeticGrant.deleteMany({ where: { userId } });
  }

  assertSlot(slot: string) {
    if (!COSMETIC_SLOTS.includes(slot as (typeof COSMETIC_SLOTS)[number])) {
      throw new BadRequestException('Slot cosmétique inconnu.');
    }
  }
}
