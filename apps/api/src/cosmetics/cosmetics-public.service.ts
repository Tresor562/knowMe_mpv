import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { COSMETIC_SLOTS } from './dto/cosmetics.dto';

type Visibility = 'PRIVATE' | 'FRIENDS' | 'PUBLIC';
type CosmeticVisibility = Visibility | 'FOLLOW_PROFILE';

type AvailableAsset = {
  active: boolean;
  startsAt: Date;
  endsAt: Date | null;
};

@Injectable()
export class CosmeticsPublicService {
  constructor(private readonly prisma: PrismaService) {}

  policy() {
    return {
      serverResolved: true,
      visualOnly: true,
      acquisitionSourceExposed: false,
      purchasePriceExposed: false,
      profileVisibilityIsUpperBound: true,
      hiddenSlotsOmitted: true,
      inactiveAssetsFallbackSafely: true,
      gameplayEffectsAllowed: false,
      paidPriorityAllowed: false
    };
  }

  resolveVisibility(
    profileVisibility: Visibility,
    cosmeticVisibility: CosmeticVisibility
  ): Visibility {
    if (cosmeticVisibility === 'FOLLOW_PROFILE') return profileVisibility;
    const rank: Record<Visibility, number> = {
      PRIVATE: 0,
      FRIENDS: 1,
      PUBLIC: 2
    };
    return rank[cosmeticVisibility] < rank[profileVisibility]
      ? cosmeticVisibility
      : profileVisibility;
  }

  canView(
    ownerId: string,
    viewerId: string,
    visibility: Visibility,
    isFriend: boolean
  ) {
    if (ownerId === viewerId) return true;
    if (visibility === 'PUBLIC') return true;
    if (visibility === 'FRIENDS') return isFriend;
    return false;
  }

  isAvailable(asset: AvailableAsset, now = new Date()) {
    return asset.active && asset.startsAt <= now && (!asset.endsAt || asset.endsAt > now);
  }

  async snapshot(viewerId: string, username: string) {
    const target = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true
      }
    });
    if (!target) throw new NotFoundException('Profil introuvable.');

    const preferences = await this.prisma.privacyPreference.upsert({
      where: { userId: target.id },
      create: { userId: target.id },
      update: {}
    });
    const effectiveVisibility = this.resolveVisibility(
      preferences.profileVisibility as Visibility,
      preferences.cosmeticVisibility as CosmeticVisibility
    );

    const isOwner = target.id === viewerId;
    const isFriend = isOwner
      ? true
      : Boolean(
          await this.prisma.friendship.findFirst({
            where: {
              status: 'ACCEPTED',
              OR: [
                { requesterId: viewerId, addresseeId: target.id },
                { requesterId: target.id, addresseeId: viewerId }
              ]
            },
            select: { id: true }
          })
        );
    const visible = this.canView(target.id, viewerId, effectiveVisibility, isFriend);

    if (!visible) {
      return {
        profile: {
          username: target.username,
          displayName: target.displayName,
          avatarUrl: null
        },
        visible: false,
        visibility: effectiveVisibility,
        slots: [],
        rules: this.policy(),
        serverTime: new Date()
      };
    }

    const equipment = await this.prisma.cosmeticEquipment.findMany({
      where: { userId: target.id },
      include: { item: true },
      orderBy: [{ slot: 'asc' }]
    });
    const hidden = new Set(preferences.hiddenCosmeticSlots);
    const now = new Date();
    const slots = equipment
      .filter((entry) =>
        COSMETIC_SLOTS.includes(entry.slot as (typeof COSMETIC_SLOTS)[number]) &&
        !hidden.has(entry.slot)
      )
      .map((entry) => {
        if (!this.isAvailable(entry.item, now)) {
          return {
            slot: entry.slot,
            item: null,
            fallback: true,
            fallbackReason: 'ASSET_UNAVAILABLE' as const
          };
        }
        return {
          slot: entry.slot,
          item: {
            id: entry.item.id,
            key: entry.item.key,
            version: entry.item.version,
            name: entry.item.name,
            description: entry.item.description,
            rarity: entry.item.rarity,
            assetUrl: entry.item.assetUrl,
            previewUrl: entry.item.previewUrl
          },
          fallback: false,
          fallbackReason: null
        };
      });

    return {
      profile: {
        accountId: target.id,
        username: target.username,
        displayName: target.displayName,
        avatarUrl: target.avatarUrl
      },
      visible: true,
      visibility: effectiveVisibility,
      viewerContext: isOwner ? 'OWNER' : isFriend ? 'FRIEND' : 'PUBLIC',
      slots,
      rules: this.policy(),
      serverTime: now
    };
  }
}
