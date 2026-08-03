'use client';

import { apiFetch } from './api';

export type AvatarLayerSlot =
  | 'AVATAR_SKIN'
  | 'AVATAR_HAIR'
  | 'AVATAR_FACE'
  | 'AVATAR_OUTFIT'
  | 'AVATAR_ACCESSORY'
  | 'AVATAR_AURA';

export type AvatarRenderSlot = AvatarLayerSlot | 'AVATAR_FRAME';

export type AvatarItem = {
  id: string;
  key: string;
  version: number;
  name: string;
  description: string | null;
  slot: AvatarRenderSlot;
  rarity: string;
  assetUrl: string;
  previewUrl: string | null;
};

export type AvatarInventoryEntry = {
  id: string;
  itemId: string;
  equipped: boolean;
  item: AvatarItem;
};

export type AvatarEquipmentEntry = {
  slot: AvatarRenderSlot;
  item: AvatarItem;
};

export type AvatarManifestLayer = {
  slot: AvatarRenderSlot;
  zIndex: number;
  item: Omit<AvatarItem, 'slot' | 'description'> | null;
  fallback: boolean;
};

export type AvatarManifest = {
  renderer: 'LAYERED_ASSET_V1' | 'HIDDEN';
  width: 512;
  height: 512;
  legacyAvatarUrl: string | null;
  fallback: {
    kind: 'INITIALS';
    initials: string;
    paletteToken: string;
  };
  layers: AvatarManifestLayer[];
  cacheKey: string;
};

export type AvatarStudioState = {
  profile: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  inventory: AvatarInventoryEntry[];
  equipment: AvatarEquipmentEntry[];
  manifest: AvatarManifest;
  rules: {
    serverResolved: true;
    serverAuthoritativeInventory: true;
    ownershipRequired: true;
    oneItemPerLayer: true;
    customUploadsAllowed: false;
    visualOnly: true;
    layerOrder: Array<{ slot: AvatarRenderSlot; zIndex: number }>;
  };
  serverTime: string;
};

export function getAvatarStudio() {
  return apiFetch<AvatarStudioState>('/avatar-studio/me');
}

export function equipAvatarLayer(slot: AvatarLayerSlot, itemId: string | null) {
  return apiFetch<{ result: unknown; studio: AvatarStudioState }>(
    `/avatar-studio/equipment/${slot}`,
    {
      method: 'PUT',
      body: JSON.stringify({ itemId })
    }
  );
}

export function getPublicAvatarStudio(username: string) {
  return apiFetch<{
    visible: boolean;
    profile: {
      accountId?: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    };
    manifest: AvatarManifest;
  }>(`/avatar-studio/public/${encodeURIComponent(username)}`);
}

export const AVATAR_LAYER_LABELS: Record<AvatarLayerSlot, string> = {
  AVATAR_SKIN: 'Base et peau',
  AVATAR_HAIR: 'Cheveux',
  AVATAR_FACE: 'Visage',
  AVATAR_OUTFIT: 'Tenue',
  AVATAR_ACCESSORY: 'Accessoire',
  AVATAR_AURA: 'Aura'
};

export const AVATAR_LAYER_SLOTS = Object.keys(
  AVATAR_LAYER_LABELS
) as AvatarLayerSlot[];
