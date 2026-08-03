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
  ActivateCosmeticPresetDto,
  CosmeticPresetItemInputDto,
  CreateCosmeticPresetDto,
  UpdateCosmeticPresetDto
} from './dto/cosmetic-presets.dto';
import { COSMETIC_SLOTS } from './dto/cosmetics.dto';

type AvailabilityCandidate = {
  active: boolean;
  startsAt: Date;
  endsAt: Date | null;
};

type LoadedPreset = Prisma.CosmeticPresetGetPayload<{
  include: { items: { include: { item: true } } };
}>;

@Injectable()
export class CosmeticPresetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  policy() {
    return {
      visualOnly: true,
      gameplayEffectsAllowed: false,
      paidPriorityAllowed: false,
      ownershipRequired: true,
      atomicActivation: true,
      idempotentActivation: true,
      hiddenSlotsRespected: true,
      unavailableItemsPruned: true,
      maxItems: COSMETIC_SLOTS.length,
      supportedSlots: COSMETIC_SLOTS
    };
  }

  normalizeName(name: string) {
    return name.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  isAvailable(item: AvailabilityCandidate, now = new Date()) {
    return item.active && item.startsAt <= now && (!item.endsAt || item.endsAt > now);
  }

  async list(userId: string) {
    const removed = await this.pruneInvalidItems(userId);
    const [presets, state] = await Promise.all([
      this.prisma.cosmeticPreset.findMany({
        where: { userId },
        include: { items: { include: { item: true }, orderBy: [{ position: 'asc' }] } },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }]
      }),
      this.prisma.cosmeticPresetState.findUnique({ where: { userId } })
    ]);

    return {
      presets: presets.map((preset) =>
        this.publicPreset(
          preset,
          state?.defaultPresetId === preset.id,
          state?.activePresetId === preset.id
        )
      ),
      state: {
        defaultPresetId: state?.defaultPresetId ?? null,
        activePresetId: state?.activePresetId ?? null,
        activationVersion: state?.activationVersion ?? 0
      },
      maintenance: { removedInvalidItems: removed },
      rules: this.policy()
    };
  }

  async create(userId: string, dto: CreateCosmeticPresetDto) {
    const name = dto.name.trim().replace(/\s+/g, ' ');
    const items = await this.validateItems(userId, dto.items);

    try {
      const preset = await this.prisma.$transaction(async (tx) => {
        const created = await tx.cosmeticPreset.create({
          data: {
            userId,
            name,
            normalizedName: this.normalizeName(name),
            items: {
              create: items.map((entry, position) => ({
                slot: entry.slot,
                itemId: entry.itemId,
                position
              }))
            }
          },
          include: { items: { include: { item: true }, orderBy: [{ position: 'asc' }] } }
        });

        if (dto.setAsDefault) {
          await tx.cosmeticPresetState.upsert({
            where: { userId },
            create: { userId, defaultPresetId: created.id },
            update: { defaultPresetId: created.id }
          });
        }
        return created;
      });

      await this.audit.record({
        actorId: userId,
        action: 'COSMETIC_PRESET_CREATED',
        entity: 'CosmeticPreset',
        entityId: preset.id,
        targetAccountId: userId,
        metadata: {
          name: preset.name,
          slots: preset.items.map((entry) => entry.slot),
          setAsDefault: Boolean(dto.setAsDefault),
          visualOnly: true
        }
      });

      return {
        preset: this.publicPreset(preset, Boolean(dto.setAsDefault), false),
        rules: this.policy()
      };
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        throw new ConflictException('Un preset porte déjà ce nom.');
      }
      throw error;
    }
  }

  async update(userId: string, presetId: string, dto: UpdateCosmeticPresetDto) {
    if (!Object.keys(dto).length) {
      throw new BadRequestException('Aucune modification de preset fournie.');
    }
    await this.requireOwnedPreset(userId, presetId);

    const name = dto.name?.trim().replace(/\s+/g, ' ');
    const items = dto.items ? await this.validateItems(userId, dto.items) : null;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        if (items) {
          await tx.cosmeticPresetItem.deleteMany({ where: { presetId } });
        }
        const preset = await tx.cosmeticPreset.update({
          where: { id: presetId },
          data: {
            ...(name
              ? { name, normalizedName: this.normalizeName(name) }
              : {}),
            ...(items
              ? {
                  items: {
                    create: items.map((entry, position) => ({
                      slot: entry.slot,
                      itemId: entry.itemId,
                      position
                    }))
                  }
                }
              : {})
          },
          include: { items: { include: { item: true }, orderBy: [{ position: 'asc' }] } }
        });

        let state = await tx.cosmeticPresetState.findUnique({ where: { userId } });
        if (dto.setAsDefault === true) {
          state = await tx.cosmeticPresetState.upsert({
            where: { userId },
            create: { userId, defaultPresetId: presetId },
            update: { defaultPresetId: presetId }
          });
        } else if (dto.setAsDefault === false && state?.defaultPresetId === presetId) {
          state = await tx.cosmeticPresetState.update({
            where: { userId },
            data: { defaultPresetId: null }
          });
        }
        return { preset, state };
      });

      await this.audit.record({
        actorId: userId,
        action: 'COSMETIC_PRESET_UPDATED',
        entity: 'CosmeticPreset',
        entityId: presetId,
        targetAccountId: userId,
        metadata: {
          fields: Object.keys(dto),
          slots: result.preset.items.map((entry) => entry.slot),
          visualOnly: true
        }
      });

      return {
        preset: this.publicPreset(
          result.preset,
          result.state?.defaultPresetId === presetId,
          result.state?.activePresetId === presetId
        ),
        rules: this.policy()
      };
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        throw new ConflictException('Un preset porte déjà ce nom.');
      }
      throw error;
    }
  }

  async setDefault(userId: string, presetId: string) {
    const preset = await this.requireOwnedPreset(userId, presetId);
    const state = await this.prisma.cosmeticPresetState.upsert({
      where: { userId },
      create: { userId, defaultPresetId: presetId },
      update: { defaultPresetId: presetId }
    });

    await this.audit.record({
      actorId: userId,
      action: 'COSMETIC_PRESET_DEFAULT_SET',
      entity: 'CosmeticPreset',
      entityId: presetId,
      targetAccountId: userId,
      metadata: { name: preset.name }
    });

    return {
      defaultPresetId: state.defaultPresetId,
      activationVersion: state.activationVersion,
      rules: this.policy()
    };
  }

  async preview(userId: string, presetId: string) {
    await this.requireOwnedPreset(userId, presetId);
    const removed = await this.pruneInvalidItems(userId, presetId);
    const [preset, preferences] = await Promise.all([
      this.requireOwnedPreset(userId, presetId),
      this.prisma.privacyPreference.findUnique({ where: { userId } })
    ]);
    const hidden = new Set(preferences?.hiddenCosmeticSlots ?? []);

    return {
      preset: this.publicPreset(preset, false, false),
      preview: preset.items.map((entry) => ({
        slot: entry.slot,
        item: this.publicItem(entry.item),
        applicable: !hidden.has(entry.slot),
        blockedReason: hidden.has(entry.slot) ? 'HIDDEN_SLOT' : null
      })),
      maintenance: { removedInvalidItems: removed },
      rules: this.policy()
    };
  }

  async activate(userId: string, presetId: string, dto: ActivateCosmeticPresetDto) {
    const existing = await this.prisma.cosmeticPresetActivation.findUnique({
      where: { idempotencyKey: dto.idempotencyKey }
    });
    if (existing) {
      if (existing.userId !== userId || existing.presetId !== presetId) {
        throw new ConflictException(
          'Cette clé d’idempotence appartient à une autre activation.'
        );
      }
      return {
        activation: existing,
        equipment: existing.equipmentSnapshot,
        replayed: true,
        rules: this.policy()
      };
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const preset = await tx.cosmeticPreset.findFirst({
          where: { id: presetId, userId },
          include: { items: { include: { item: true }, orderBy: [{ position: 'asc' }] } }
        });
        if (!preset) throw new NotFoundException('Preset cosmétique introuvable.');

        const itemIds = preset.items.map((entry) => entry.itemId);
        const [ownerships, preferences] = await Promise.all([
          tx.cosmeticOwnership.findMany({
            where: { userId, itemId: { in: itemIds }, revokedAt: null },
            select: { itemId: true }
          }),
          tx.privacyPreference.findUnique({ where: { userId } })
        ]);
        const owned = new Set(ownerships.map((entry) => entry.itemId));
        const hidden = new Set(preferences?.hiddenCosmeticSlots ?? []);
        const now = new Date();
        const invalidItemIds: string[] = [];
        const applied = preset.items.filter((entry) => {
          const valid =
            owned.has(entry.itemId) &&
            entry.item.slot === entry.slot &&
            COSMETIC_SLOTS.includes(entry.slot as (typeof COSMETIC_SLOTS)[number]) &&
            this.isAvailable(entry.item, now);
          if (!valid) invalidItemIds.push(entry.id);
          return valid && !hidden.has(entry.slot);
        });
        const skippedHiddenSlots = preset.items
          .filter((entry) => hidden.has(entry.slot))
          .map((entry) => entry.slot);

        if (invalidItemIds.length) {
          await tx.cosmeticPresetItem.deleteMany({ where: { id: { in: invalidItemIds } } });
        }

        await tx.cosmeticEquipment.deleteMany({ where: { userId } });
        if (applied.length) {
          await tx.cosmeticEquipment.createMany({
            data: applied.map((entry) => ({
              userId,
              slot: entry.slot,
              itemId: entry.itemId,
              equippedAt: now
            }))
          });
        }

        const state = await tx.cosmeticPresetState.upsert({
          where: { userId },
          create: {
            userId,
            activePresetId: presetId,
            activationVersion: 1
          },
          update: {
            activePresetId: presetId,
            activationVersion: { increment: 1 }
          }
        });

        const equipmentSnapshot = {
          presetId,
          presetName: preset.name,
          activationVersion: state.activationVersion,
          applied: applied.map((entry) => ({
            slot: entry.slot,
            itemId: entry.itemId,
            itemKey: entry.item.key,
            itemVersion: entry.item.version
          })),
          skippedHiddenSlots,
          prunedInvalidItems: invalidItemIds.length,
          activatedAt: now.toISOString()
        };
        const activation = await tx.cosmeticPresetActivation.create({
          data: {
            userId,
            presetId,
            presetName: preset.name,
            idempotencyKey: dto.idempotencyKey,
            equipmentSnapshot: equipmentSnapshot as Prisma.InputJsonValue,
            activatedAt: now
          }
        });
        const equipment = await tx.cosmeticEquipment.findMany({
          where: { userId },
          include: { item: true },
          orderBy: [{ slot: 'asc' }]
        });

        return { preset, state, activation, equipment, equipmentSnapshot };
      });

      await this.audit.record({
        actorId: userId,
        action: 'COSMETIC_PRESET_ACTIVATED',
        entity: 'CosmeticPreset',
        entityId: presetId,
        targetAccountId: userId,
        metadata: {
          name: result.preset.name,
          activationVersion: result.state.activationVersion,
          appliedSlots: result.equipment.map((entry) => entry.slot),
          skippedHiddenSlots: result.equipmentSnapshot.skippedHiddenSlots,
          prunedInvalidItems: result.equipmentSnapshot.prunedInvalidItems,
          visualOnly: true,
          idempotencyKey: dto.idempotencyKey
        }
      });

      return {
        activation: result.activation,
        state: {
          defaultPresetId: result.state.defaultPresetId,
          activePresetId: result.state.activePresetId,
          activationVersion: result.state.activationVersion
        },
        equipment: result.equipment.map((entry) => ({
          id: entry.id,
          slot: entry.slot,
          itemId: entry.itemId,
          equippedAt: entry.equippedAt,
          item: this.publicItem(entry.item)
        })),
        maintenance: {
          prunedInvalidItems: result.equipmentSnapshot.prunedInvalidItems,
          skippedHiddenSlots: result.equipmentSnapshot.skippedHiddenSlots
        },
        replayed: false,
        rules: this.policy()
      };
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        const replay = await this.prisma.cosmeticPresetActivation.findUnique({
          where: { idempotencyKey: dto.idempotencyKey }
        });
        if (replay && replay.userId === userId && replay.presetId === presetId) {
          return {
            activation: replay,
            equipment: replay.equipmentSnapshot,
            replayed: true,
            rules: this.policy()
          };
        }
      }
      throw error;
    }
  }

  async remove(userId: string, presetId: string) {
    const preset = await this.requireOwnedPreset(userId, presetId);
    await this.prisma.cosmeticPreset.delete({ where: { id: presetId } });

    await this.audit.record({
      actorId: userId,
      action: 'COSMETIC_PRESET_DELETED',
      entity: 'CosmeticPreset',
      entityId: presetId,
      targetAccountId: userId,
      metadata: { name: preset.name }
    });

    return { deleted: true, presetId };
  }

  async exportForAccount(userId: string) {
    const [presets, state, activations] = await Promise.all([
      this.prisma.cosmeticPreset.findMany({
        where: { userId },
        include: { items: { include: { item: true }, orderBy: [{ position: 'asc' }] } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
      }),
      this.prisma.cosmeticPresetState.findUnique({ where: { userId } }),
      this.prisma.cosmeticPresetActivation.findMany({
        where: { userId },
        orderBy: [{ activatedAt: 'desc' }, { id: 'desc' }]
      })
    ]);
    return { presets, state, activations, rules: this.policy() };
  }

  async deleteForAccount(userId: string, tx: Prisma.TransactionClient) {
    await tx.cosmeticPresetState.deleteMany({ where: { userId } });
    await tx.cosmeticPresetActivation.deleteMany({ where: { userId } });
    await tx.cosmeticPreset.deleteMany({ where: { userId } });
  }

  private async validateItems(userId: string, requested: CosmeticPresetItemInputDto[]) {
    const itemIds = requested.map((entry) => entry.itemId);
    const [items, ownerships] = await Promise.all([
      this.prisma.cosmeticItemDefinition.findMany({ where: { id: { in: itemIds } } }),
      this.prisma.cosmeticOwnership.findMany({
        where: { userId, itemId: { in: itemIds }, revokedAt: null },
        select: { itemId: true }
      })
    ]);
    const byId = new Map(items.map((item) => [item.id, item]));
    const owned = new Set(ownerships.map((entry) => entry.itemId));

    return requested.map((entry) => {
      const item = byId.get(entry.itemId);
      if (!item) throw new NotFoundException('Objet cosmétique introuvable.');
      if (!owned.has(entry.itemId)) {
        throw new ForbiddenException('Un objet du preset ne fait pas partie de ton inventaire.');
      }
      if (item.slot !== entry.slot) {
        throw new BadRequestException('Un objet ne correspond pas au slot déclaré.');
      }
      if (!this.isAvailable(item)) {
        throw new BadRequestException('Un objet du preset n’est pas actuellement disponible.');
      }
      return { slot: entry.slot, itemId: entry.itemId };
    });
  }

  private async requireOwnedPreset(userId: string, presetId: string): Promise<LoadedPreset> {
    const preset = await this.prisma.cosmeticPreset.findFirst({
      where: { id: presetId, userId },
      include: { items: { include: { item: true }, orderBy: [{ position: 'asc' }] } }
    });
    if (!preset) throw new NotFoundException('Preset cosmétique introuvable.');
    return preset;
  }

  private async pruneInvalidItems(userId: string, presetId?: string) {
    const entries = await this.prisma.cosmeticPresetItem.findMany({
      where: {
        preset: { userId, ...(presetId ? { id: presetId } : {}) }
      },
      include: { item: true }
    });
    if (!entries.length) return 0;

    const ownerships = await this.prisma.cosmeticOwnership.findMany({
      where: {
        userId,
        itemId: { in: entries.map((entry) => entry.itemId) },
        revokedAt: null
      },
      select: { itemId: true }
    });
    const owned = new Set(ownerships.map((entry) => entry.itemId));
    const now = new Date();
    const invalidIds = entries
      .filter(
        (entry) =>
          !owned.has(entry.itemId) ||
          entry.item.slot !== entry.slot ||
          !this.isAvailable(entry.item, now)
      )
      .map((entry) => entry.id);

    if (!invalidIds.length) return 0;
    await this.prisma.cosmeticPresetItem.deleteMany({ where: { id: { in: invalidIds } } });
    await this.audit.record({
      actorId: userId,
      action: 'COSMETIC_PRESET_ITEMS_PRUNED',
      entity: 'CosmeticPreset',
      entityId: presetId ?? userId,
      targetAccountId: userId,
      metadata: { removedItems: invalidIds.length }
    });
    return invalidIds.length;
  }

  private publicPreset(preset: LoadedPreset, isDefault: boolean, isActive: boolean) {
    return {
      id: preset.id,
      name: preset.name,
      isDefault,
      isActive,
      createdAt: preset.createdAt,
      updatedAt: preset.updatedAt,
      items: preset.items.map((entry) => ({
        id: entry.id,
        slot: entry.slot,
        itemId: entry.itemId,
        position: entry.position,
        item: this.publicItem(entry.item)
      }))
    };
  }

  private publicItem(item: {
    id: string;
    key: string;
    version: number;
    name: string;
    description: string | null;
    slot: string;
    rarity: string;
    assetUrl: string;
    previewUrl: string | null;
  }) {
    return {
      id: item.id,
      key: item.key,
      version: item.version,
      name: item.name,
      description: item.description,
      slot: item.slot,
      rarity: item.rarity,
      assetUrl: item.assetUrl,
      previewUrl: item.previewUrl
    };
  }

  private isUniqueConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
