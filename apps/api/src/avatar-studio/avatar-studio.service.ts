import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CosmeticsPublicService } from '../cosmetics/cosmetics-public.service';
import { CosmeticsService } from '../cosmetics/cosmetics.service';
import {
  AVATAR_LAYER_SLOTS,
  EquipCosmeticDto
} from '../cosmetics/dto/cosmetics.dto';

const AVATAR_RENDER_SLOTS = [
  ...AVATAR_LAYER_SLOTS,
  'AVATAR_FRAME'
] as const;

const AVATAR_Z_INDEX: Record<(typeof AVATAR_RENDER_SLOTS)[number], number> = {
  AVATAR_SKIN: 10,
  AVATAR_HAIR: 20,
  AVATAR_FACE: 30,
  AVATAR_OUTFIT: 40,
  AVATAR_ACCESSORY: 50,
  AVATAR_AURA: 60,
  AVATAR_FRAME: 70
};

type CosmeticItem = {
  id: string;
  key: string;
  version: number;
  name: string;
  description: string | null;
  slot: string;
  rarity: string;
  assetUrl: string;
  previewUrl: string | null;
};

type EquipmentEntry = {
  slot: string;
  item: CosmeticItem;
};

type InventoryEntry = {
  id: string;
  itemId: string;
  equipped: boolean;
  item: CosmeticItem;
};

@Injectable()
export class AvatarStudioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cosmetics: CosmeticsService,
    private readonly publicCosmetics: CosmeticsPublicService
  ) {}

  policy() {
    return {
      schemaVersion: 1,
      serverResolved: true,
      serverAuthoritativeInventory: true,
      ownershipRequired: true,
      oneItemPerLayer: true,
      customUploadsAllowed: false,
      remoteClientAssetsAllowed: false,
      visualOnly: true,
      gameplayEffectsAllowed: false,
      paidPriorityAllowed: false,
      safeInitialsFallback: true,
      publicVisibilityUsesCosmeticPrivacy: true,
      layerOrder: AVATAR_RENDER_SLOTS.map((slot) => ({
        slot,
        zIndex: AVATAR_Z_INDEX[slot]
      }))
    } as const;
  }

  async me(userId: string) {
    const [user, state] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true
        }
      }),
      this.cosmetics.me(userId)
    ]);
    if (!user) throw new NotFoundException('Compte introuvable.');

    const inventory = (state.inventory as InventoryEntry[]).filter((entry) =>
      this.isAvatarSlot(entry.item.slot)
    );
    const equipment = (state.equipment as EquipmentEntry[]).filter((entry) =>
      this.isAvatarSlot(entry.slot)
    );

    return {
      profile: user,
      inventory,
      equipment,
      manifest: this.manifest(user, equipment),
      rules: this.policy(),
      serverTime: new Date()
    };
  }

  async equip(userId: string, slot: string, dto: EquipCosmeticDto) {
    if (!AVATAR_LAYER_SLOTS.includes(slot as (typeof AVATAR_LAYER_SLOTS)[number])) {
      throw new BadRequestException('Couche d’avatar inconnue.');
    }
    const result = await this.cosmetics.equip(userId, slot, dto);
    return {
      result,
      studio: await this.me(userId)
    };
  }

  async publicSnapshot(viewerId: string, username: string) {
    const snapshot = await this.publicCosmetics.snapshot(viewerId, username);
    const slots = snapshot.slots.filter((entry) => this.isAvatarSlot(entry.slot));
    const equipment = slots
      .filter((entry): entry is typeof entry & { item: NonNullable<typeof entry.item> } =>
        Boolean(entry.item)
      )
      .map((entry) => ({
        slot: entry.slot,
        item: {
          ...entry.item,
          slot: entry.slot
        }
      })) as EquipmentEntry[];

    return {
      ...snapshot,
      slots,
      manifest: snapshot.visible
        ? this.manifest(snapshot.profile, equipment)
        : this.hiddenManifest(snapshot.profile.displayName),
      rules: {
        ...snapshot.rules,
        ...this.policy(),
        profileVisibilityIsUpperBound: true
      }
    };
  }

  manifest(
    profile: {
      username?: string;
      displayName: string;
      avatarUrl: string | null;
    },
    equipment: EquipmentEntry[]
  ) {
    const bySlot = new Map(equipment.map((entry) => [entry.slot, entry.item] as const));
    const layers = AVATAR_RENDER_SLOTS.map((slot) => {
      const item = bySlot.get(slot);
      return {
        slot,
        zIndex: AVATAR_Z_INDEX[slot],
        item: item
          ? {
              id: item.id,
              key: item.key,
              version: item.version,
              name: item.name,
              rarity: item.rarity,
              assetUrl: item.assetUrl,
              previewUrl: item.previewUrl
            }
          : null,
        fallback: !item
      };
    });

    return {
      renderer: 'LAYERED_ASSET_V1' as const,
      width: 512,
      height: 512,
      legacyAvatarUrl: profile.avatarUrl,
      fallback: this.initialsFallback(profile.displayName, profile.username),
      layers,
      cacheKey: layers
        .map((layer) => `${layer.slot}:${layer.item?.id ?? 'none'}:${layer.item?.version ?? 0}`)
        .join('|')
    };
  }

  private hiddenManifest(displayName: string) {
    return {
      renderer: 'HIDDEN' as const,
      width: 512,
      height: 512,
      legacyAvatarUrl: null,
      fallback: this.initialsFallback(displayName),
      layers: [],
      cacheKey: 'hidden'
    };
  }

  private initialsFallback(displayName: string, username = '') {
    const initials = displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '?';
    const source = `${username}:${displayName}`;
    let hash = 0;
    for (let index = 0; index < source.length; index += 1) {
      hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
    }
    return {
      kind: 'INITIALS' as const,
      initials,
      paletteToken: `avatar-palette-${hash % 12}`
    };
  }

  private isAvatarSlot(slot: string): slot is (typeof AVATAR_RENDER_SLOTS)[number] {
    return AVATAR_RENDER_SLOTS.includes(slot as (typeof AVATAR_RENDER_SLOTS)[number]);
  }
}
