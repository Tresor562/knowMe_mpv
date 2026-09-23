import { BadRequestException } from '@nestjs/common';
import { AVATAR_ALL_SLOTS } from '../avatar-universe/avatar-universe.domain';
import { AvatarStudioService } from './avatar-studio.service';

describe('AvatarStudioService', () => {
  function setup() {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          username: 'avatar_user',
          displayName: 'Avatar User',
          avatarUrl: null
        })
      }
    };
    const cosmetics = {
      me: jest.fn().mockResolvedValue({ inventory: [], equipment: [] }),
      equip: jest.fn().mockResolvedValue({ slot: 'AVATAR_HAIR', itemId: null })
    };
    const publicCosmetics = {
      snapshot: jest.fn().mockResolvedValue({
        visible: false,
        reason: 'COSMETICS_PRIVATE',
        profile: {
          username: 'avatar_user',
          displayName: 'Avatar User',
          avatarUrl: null
        },
        slots: [],
        rules: { visualOnly: true }
      })
    };
    return {
      prisma,
      cosmetics,
      publicCosmetics,
      service: new AvatarStudioService(
        prisma as never,
        cosmetics as never,
        publicCosmetics as never
      )
    };
  }

  it('keeps the studio visual-only, inventory-authoritative and exhaustive over canonical avatar slots', () => {
    const { service } = setup();
    expect(service.policy()).toMatchObject({
      serverResolved: true,
      serverAuthoritativeInventory: true,
      ownershipRequired: true,
      oneItemPerLayer: true,
      customUploadsAllowed: false,
      remoteClientAssetsAllowed: false,
      visualOnly: true,
      gameplayEffectsAllowed: false,
      paidPriorityAllowed: false,
      publicVisibilityUsesCosmeticPrivacy: true
    });
    const layerOrder = service.policy().layerOrder;
    expect(layerOrder.map((entry) => entry.slot)).toEqual([...AVATAR_ALL_SLOTS]);
    expect(new Set(layerOrder.map((entry) => entry.slot)).size).toBe(AVATAR_ALL_SLOTS.length);
    expect(layerOrder.every((entry) => Number.isFinite(entry.zIndex))).toBe(true);
  });

  it('builds a deterministic ordered manifest with safe fallbacks for every canonical slot', () => {
    const { service } = setup();
    const manifest = service.manifest(
      {
        username: 'avatar_user',
        displayName: 'Avatar User',
        avatarUrl: null
      },
      [
        {
          slot: 'AVATAR_HAIR',
          item: {
            id: 'hair-1',
            key: 'midnight-hair',
            version: 2,
            name: 'Cheveux minuit',
            description: null,
            slot: 'AVATAR_HAIR',
            rarity: 'RARE',
            assetUrl: 'https://assets.example/hair.png',
            previewUrl: null
          }
        }
      ]
    );

    expect(manifest.renderer).toBe('LAYERED_ASSET_V1');
    expect(manifest.width).toBe(512);
    expect(manifest.height).toBe(512);
    expect(manifest.fallback).toMatchObject({ kind: 'INITIALS', initials: 'AU' });
    expect(manifest.layers.map((entry) => entry.slot)).toEqual([...AVATAR_ALL_SLOTS]);
    expect(manifest.layers.find((entry) => entry.slot === 'AVATAR_HAIR')).toMatchObject({
      zIndex: 30,
      fallback: false,
      item: {
        id: 'hair-1',
        key: 'midnight-hair',
        version: 2
      }
    });
    expect(manifest.layers.find((entry) => entry.slot === 'AVATAR_FOOTWEAR')).toMatchObject({ fallback: true, item: null });
    expect(manifest.layers.find((entry) => entry.slot === 'AVATAR_WEAPON_STYLE')).toMatchObject({ fallback: true, item: null });
    expect(manifest.layers.find((entry) => entry.slot === 'AVATAR_COMPANION')).toMatchObject({ fallback: true, item: null });
    expect(manifest.cacheKey).toContain('AVATAR_HAIR:hair-1:2');
  });

  it('delegates every canonical avatar layer to the cosmetic authority and rejects non-avatar cosmetics', async () => {
    const { service, cosmetics } = setup();

    await expect(
      service.equip('user-1', 'PROFILE_BACKGROUND', { itemId: null })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(cosmetics.equip).not.toHaveBeenCalled();

    for (const slot of AVATAR_ALL_SLOTS) {
      await service.equip('user-1', slot, { itemId: null });
      expect(cosmetics.equip).toHaveBeenCalledWith('user-1', slot, { itemId: null });
    }
    expect(cosmetics.equip).toHaveBeenCalledTimes(AVATAR_ALL_SLOTS.length);
  });

  it('returns a hidden manifest when cosmetic privacy denies the viewer', async () => {
    const { service } = setup();
    await expect(service.publicSnapshot('viewer-1', 'avatar_user')).resolves.toMatchObject({
      visible: false,
      manifest: {
        renderer: 'HIDDEN',
        layers: [],
        cacheKey: 'hidden'
      }
    });
  });
});
