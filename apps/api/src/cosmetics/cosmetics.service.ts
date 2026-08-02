import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../observability/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  COSMETIC_SLOTS,
  CreateCosmeticItemDto,
  EquipCosmeticDto,
  GrantCosmeticItemDto,
  RevokeCosmeticOwnershipDto
} from './dto/cosmetics.dto';

type AvailabilityCandidate = {
  active: boolean;
  startsAt: Date;
  endsAt: Date | null;
};

@Injectable()
export class CosmeticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  policy() {
    return {
      visualOnly: true,
      gameplayEffectsAllowed: false,
      purchasesEnabled: false,
      paidPriorityAllowed: false,
      ownershipRequired: true,
      oneItemPerSlot: true,
      serverAuthoritativeInventory: true,
      immutablePublishedVersions: true,
      supportedSlots: COSMETIC_SLOTS
    };
  }

  isAvailable(item: AvailabilityCandidate, now = new Date()) {
    return item.active && item.startsAt <= now && (!item.endsAt || item.endsAt > now);
  }

  slotMatches(itemSlot: string, requestedSlot: string) {
    return itemSlot === requestedSlot;
  }

  async catalog(now = new Date()) {
    const candidates = await this.prisma.cosmeticItemDefinition.findMany({
      where: {
        active: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }]
      },
      orderBy: [{ key: 'asc' }, { version: 'desc' }]
    });

    const latestByKey = new Map<string, (typeof candidates)[number]>();
    for (const item of candidates) {
      if (!latestByKey.has(item.key)) latestByKey.set(item.key, item);
    }

    return {
      items: Array.from(latestByKey.values()).sort((left, right) =>
        `${left.slot}:${left.name}`.localeCompare(`${right.slot}:${right.name}`)
      ),
      rules: this.policy(),
      serverTime: now
    };
  }

  async me(userId: string) {
    const [ownerships, equipment] = await Promise.all([
      this.prisma.cosmeticOwnership.findMany({
        where: { userId, revokedAt: null },
        include: { item: true },
        orderBy: [{ acquiredAt: 'desc' }, { id: 'desc' }]
      }),
      this.prisma.cosmeticEquipment.findMany({
        where: { userId },
        include: { item: true },
        orderBy: [{ slot: 'asc' }]
      })
    ]);
    const equippedIds = new Set(equipment.map((entry) => entry.itemId));

    return {
      inventory: ownerships.map((ownership) => ({
        ...ownership,
        equipped: equippedIds.has(ownership.itemId)
      })),
      equipment,
      rules: this.policy()
    };
  }

  async createItem(actorId: string, dto: CreateCosmeticItemDto) {
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date();
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (endsAt && endsAt <= startsAt) {
      throw new BadRequestException('La fin de disponibilité doit suivre son début.');
    }

    try {
      const item = await this.prisma.cosmeticItemDefinition.create({
        data: {
          key: dto.key,
          version: dto.version,
          name: dto.name,
          description: dto.description?.trim() || null,
          slot: dto.slot,
          rarity: dto.rarity,
          assetUrl: dto.assetUrl,
          previewUrl: dto.previewUrl ?? null,
          active: dto.active ?? false,
          startsAt,
          endsAt,
          createdById: actorId,
          reason: dto.reason
        }
      });

      await this.audit.record({
        actorId,
        action: 'COSMETIC_ITEM_PUBLISHED',
        entity: 'CosmeticItemDefinition',
        entityId: item.id,
        metadata: {
          key: item.key,
          version: item.version,
          slot: item.slot,
          rarity: item.rarity,
          active: item.active,
          visualOnly: true
        }
      });

      return item;
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        throw new ConflictException('Cette version cosmétique existe déjà.');
      }
      throw error;
    }
  }

  async grant(actorId: string, dto: GrantCosmeticItemDto) {
    const [user, item, existing] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: dto.userId }, select: { id: true } }),
      this.prisma.cosmeticItemDefinition.findUnique({ where: { id: dto.itemId } }),
      this.prisma.cosmeticOwnership.findUnique({
        where: { userId_itemId: { userId: dto.userId, itemId: dto.itemId } }
      })
    ]);
    if (!user) throw new NotFoundException('Compte bénéficiaire introuvable.');
    if (!item) throw new NotFoundException('Objet cosmétique introuvable.');

    if (existing && !existing.revokedAt) {
      return { ownership: existing, replayed: true, reactivated: false };
    }

    const ownership = existing
      ? await this.prisma.cosmeticOwnership.update({
          where: { id: existing.id },
          data: {
            source: dto.source,
            externalReference: dto.externalReference ?? null,
            grantedById: actorId,
            reason: dto.reason,
            acquiredAt: new Date(),
            revokedAt: null,
            revokedById: null
          }
        })
      : await this.createOwnership(actorId, dto);

    await this.audit.record({
      actorId,
      action: existing ? 'COSMETIC_OWNERSHIP_REACTIVATED' : 'COSMETIC_OWNERSHIP_GRANTED',
      entity: 'CosmeticOwnership',
      entityId: ownership.id,
      targetAccountId: dto.userId,
      metadata: {
        itemId: dto.itemId,
        source: dto.source,
        externalReference: dto.externalReference ?? null,
        purchaseSource: false
      }
    });

    return { ownership, replayed: false, reactivated: Boolean(existing) };
  }

  async revoke(actorId: string, ownershipId: string, dto: RevokeCosmeticOwnershipDto) {
    const ownership = await this.prisma.cosmeticOwnership.findUnique({
      where: { id: ownershipId },
      include: { item: true }
    });
    if (!ownership) throw new NotFoundException('Possession cosmétique introuvable.');
    if (ownership.revokedAt) return { ownership, replayed: true, unequippedSlots: 0 };

    const result = await this.prisma.$transaction(async (tx) => {
      const unequipped = await tx.cosmeticEquipment.deleteMany({
        where: { userId: ownership.userId, itemId: ownership.itemId }
      });
      const revoked = await tx.cosmeticOwnership.update({
        where: { id: ownership.id },
        data: { revokedAt: new Date(), revokedById: actorId }
      });
      return { ownership: revoked, unequippedSlots: unequipped.count };
    });

    await this.audit.record({
      actorId,
      action: 'COSMETIC_OWNERSHIP_REVOKED',
      entity: 'CosmeticOwnership',
      entityId: ownership.id,
      targetAccountId: ownership.userId,
      metadata: {
        itemId: ownership.itemId,
        slot: ownership.item.slot,
        reason: dto.reason,
        unequippedSlots: result.unequippedSlots
      }
    });

    return { ...result, replayed: false };
  }

  async equip(userId: string, slot: string, dto: EquipCosmeticDto) {
    if (!COSMETIC_SLOTS.includes(slot as (typeof COSMETIC_SLOTS)[number])) {
      throw new BadRequestException('Emplacement cosmétique inconnu.');
    }

    const current = await this.prisma.cosmeticEquipment.findUnique({
      where: { userId_slot: { userId, slot } },
      include: { item: true }
    });

    if (!dto.itemId) {
      if (!current) return { slot, item: null, replayed: true };
      await this.prisma.cosmeticEquipment.delete({ where: { id: current.id } });
      await this.audit.record({
        actorId: userId,
        action: 'COSMETIC_ITEM_UNEQUIPPED',
        entity: 'CosmeticEquipment',
        entityId: current.id,
        targetAccountId: userId,
        metadata: { slot, itemId: current.itemId }
      });
      return { slot, item: null, replayed: false };
    }

    if (current?.itemId === dto.itemId) {
      return { slot, item: current.item, equipment: current, replayed: true };
    }

    const [item, ownership] = await Promise.all([
      this.prisma.cosmeticItemDefinition.findUnique({ where: { id: dto.itemId } }),
      this.prisma.cosmeticOwnership.findUnique({
        where: { userId_itemId: { userId, itemId: dto.itemId } }
      })
    ]);
    if (!item) throw new NotFoundException('Objet cosmétique introuvable.');
    if (!ownership || ownership.revokedAt) {
      throw new ForbiddenException('Cet objet ne fait pas partie de ton inventaire.');
    }
    if (!this.slotMatches(item.slot, slot)) {
      throw new BadRequestException('Cet objet ne correspond pas à cet emplacement.');
    }
    if (!this.isAvailable(item)) {
      throw new BadRequestException('Cet objet cosmétique n’est pas actuellement disponible.');
    }

    const equipment = await this.prisma.cosmeticEquipment.upsert({
      where: { userId_slot: { userId, slot } },
      create: { userId, slot, itemId: item.id },
      update: { itemId: item.id, equippedAt: new Date() },
      include: { item: true }
    });

    await this.audit.record({
      actorId: userId,
      action: 'COSMETIC_ITEM_EQUIPPED',
      entity: 'CosmeticEquipment',
      entityId: equipment.id,
      targetAccountId: userId,
      metadata: { slot, itemId: item.id, visualOnly: true }
    });

    return { slot, item: equipment.item, equipment, replayed: false };
  }

  async exportForAccount(userId: string) {
    const [ownerships, equipment] = await Promise.all([
      this.prisma.cosmeticOwnership.findMany({
        where: { userId },
        include: { item: true },
        orderBy: [{ acquiredAt: 'desc' }, { id: 'desc' }]
      }),
      this.prisma.cosmeticEquipment.findMany({
        where: { userId },
        include: { item: true },
        orderBy: [{ slot: 'asc' }]
      })
    ]);
    return { ownerships, equipment, rules: this.policy() };
  }

  async deleteForAccount(userId: string, tx: Prisma.TransactionClient) {
    await tx.cosmeticEquipment.deleteMany({ where: { userId } });
    await tx.cosmeticOwnership.deleteMany({ where: { userId } });
  }

  private async createOwnership(actorId: string, dto: GrantCosmeticItemDto) {
    try {
      return await this.prisma.cosmeticOwnership.create({
        data: {
          userId: dto.userId,
          itemId: dto.itemId,
          source: dto.source,
          externalReference: dto.externalReference ?? null,
          grantedById: actorId,
          reason: dto.reason
        }
      });
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        const replay = await this.prisma.cosmeticOwnership.findUnique({
          where: { userId_itemId: { userId: dto.userId, itemId: dto.itemId } }
        });
        if (replay) return replay;
      }
      throw error;
    }
  }

  private isUniqueConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
