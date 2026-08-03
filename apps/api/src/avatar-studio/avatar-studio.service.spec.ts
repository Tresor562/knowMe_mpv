import { BadRequestException } from '@nestjs/common';
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

  it('keeps the studio visual-only and inventory-authoritative', () => {
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
    expect(service.policy().layerOrder.map((entry) => entry.slot)).toEqual([
      'AVATAR_SKIN',
      'AVATAR_HAIR',
      'AVATAR_FACE',
      'AVATAR_OUTFIT',
      'AVATAR_ACCESSORY',
      'AVATAR_AURA',
      'AVATAR_FRAME'
    ]);
  });

  it('builds a deterministic ordered manifest with safe fallbacks', () => {
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
    expect(manifest.layers.find((entry) => entry.slot === 'AVATAR_HAIR')).toMatchObject({
      zIndex: 20,
      fallback: false,
      item: {
        id: 'hair-1',
        key: 'midnight-hair',
        version: 2
      }
    });
    expect(manifest.layers.find((entry) => entry.slot === 'AVATAR_SKIN')).toMatchObject({
      fallback: true,
      item: null
    });
    expect(manifest.cacheKey).toContain('AVATAR_HAIR:hair-1:2');
  });

  it('delegates only avatar layer equipment to the cosmetic authority', async () => {
    const { service, cosmetics } = setup();

    await expect(
      service.equip('user-1', 'PROFILE_BACKGROUND', { itemId: null })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(cosmetics.equip).not.toHaveBeenCalled();

    await service.equip('user-1', 'AVATAR_HAIR', { itemId: null });
    expect(cosmetics.equip).toHaveBeenCalledWith(
      'user-1',
      'AVATAR_HAIR',
      { itemId: null }
    );
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
