import { apiFetch } from './api';

export type MobileAvatarLayerSlot =
  | 'AVATAR_SKIN'
  | 'AVATAR_HAIR'
  | 'AVATAR_FACE'
  | 'AVATAR_OUTFIT'
  | 'AVATAR_ACCESSORY'
  | 'AVATAR_AURA';

export type MobileAvatarRenderSlot = MobileAvatarLayerSlot | 'AVATAR_FRAME';

export type MobileAvatarItem = {
  id: string;
  key: string;
  version: number;
  name: string;
  description: string | null;
  slot: MobileAvatarRenderSlot;
  rarity: string;
  assetUrl: string;
  previewUrl: string | null;
};

export type MobileAvatarInventoryEntry = {
  id: string;
  itemId: string;
  equipped: boolean;
  item: MobileAvatarItem;
};

export type MobileAvatarManifest = {
  renderer: 'LAYERED_ASSET_V1' | 'HIDDEN';
  width: 512;
  height: 512;
  legacyAvatarUrl: string | null;
  fallback: {
    kind: 'INITIALS';
    initials: string;
    paletteToken: string;
  };
  layers: Array<{
    slot: MobileAvatarRenderSlot;
    zIndex: number;
    item: {
      id: string;
      key: string;
      version: number;
      name: string;
      rarity: string;
      assetUrl: string;
      previewUrl: string | null;
    } | null;
    fallback: boolean;
  }>;
  cacheKey: string;
};

export type MobileAvatarStudioState = {
  profile: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  inventory: MobileAvatarInventoryEntry[];
  equipment: Array<{ slot: MobileAvatarRenderSlot; item: MobileAvatarItem }>;
  manifest: MobileAvatarManifest;
  rules: {
    serverResolved: true;
    serverAuthoritativeInventory: true;
    ownershipRequired: true;
    oneItemPerLayer: true;
    customUploadsAllowed: false;
    visualOnly: true;
  };
};

export function getMobileAvatarStudio() {
  return apiFetch<MobileAvatarStudioState>('/avatar-studio/me');
}

export function equipMobileAvatarLayer(
  slot: MobileAvatarLayerSlot,
  itemId: string | null
) {
  return apiFetch<{ result: unknown; studio: MobileAvatarStudioState }>(
    `/avatar-studio/equipment/${slot}`,
    {
      method: 'PUT',
      body: JSON.stringify({ itemId })
    }
  );
}

export const MOBILE_AVATAR_LAYER_LABELS: Record<MobileAvatarLayerSlot, string> = {
  AVATAR_SKIN: 'Base et peau',
  AVATAR_HAIR: 'Cheveux',
  AVATAR_FACE: 'Visage',
  AVATAR_OUTFIT: 'Tenue',
  AVATAR_ACCESSORY: 'Accessoire',
  AVATAR_AURA: 'Aura'
};

export const MOBILE_AVATAR_LAYER_SLOTS = Object.keys(
  MOBILE_AVATAR_LAYER_LABELS
) as MobileAvatarLayerSlot[];
