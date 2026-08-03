import { apiFetch } from './api';

export type CosmeticItem = {
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

export type CosmeticOwnership = {
  id: string;
  userId: string;
  itemId: string;
  source: string;
  acquiredAt: string;
  equipped: boolean;
  item: CosmeticItem;
};

export type CosmeticEquipment = {
  id: string;
  slot: string;
  itemId: string;
  equippedAt: string;
  item: CosmeticItem;
};

export type CosmeticOffer = {
  id: string;
  key: string;
  version: number;
  itemId: string;
  priceKnowCoins: number;
  active: boolean;
  startsAt: string;
  endsAt: string | null;
  owned: boolean;
  affordable: boolean;
  item: CosmeticItem;
};

export type CosmeticPurchaseReceipt = {
  id: string;
  userId: string;
  offerId: string;
  itemId: string;
  priceKnowCoins: number;
  idempotencyKey: string;
  ledgerEntryId: string;
  purchasedAt: string;
  item: CosmeticItem;
};

export type CosmeticPresetItem = {
  id: string;
  slot: string;
  itemId: string;
  position: number;
  item: CosmeticItem;
};

export type CosmeticPreset = {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  items: CosmeticPresetItem[];
};

export type CosmeticPresetState = {
  defaultPresetId: string | null;
  activePresetId: string | null;
  activationVersion: number;
};

export type CosmeticPresetInput = {
  slot: string;
  itemId: string;
};

export type PublicCosmeticSlot = {
  slot: string;
  item: CosmeticItem | null;
  fallback: boolean;
  fallbackReason: string | null;
};

export type PublicCosmeticSnapshot = {
  profile: {
    accountId?: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  visible: boolean;
  visibility: 'PRIVATE' | 'FRIENDS' | 'PUBLIC';
  viewerContext?: 'OWNER' | 'FRIEND' | 'PUBLIC';
  slots: PublicCosmeticSlot[];
  rules: Record<string, unknown>;
  serverTime: string;
};

export type CosmeticPrivacyPreferences = {
  profileVisibility: 'PRIVATE' | 'FRIENDS' | 'PUBLIC';
  cosmeticVisibility: 'FOLLOW_PROFILE' | 'PRIVATE' | 'FRIENDS' | 'PUBLIC';
  hiddenCosmeticSlots: string[];
  version: number;
};

export function fetchCosmeticCatalog() {
  return apiFetch<{
    items: CosmeticItem[];
    rules: Record<string, unknown>;
    serverTime: string;
  }>('/cosmetics/catalog');
}

export function fetchCosmeticInventory() {
  return apiFetch<{
    inventory: CosmeticOwnership[];
    equipment: CosmeticEquipment[];
    rules: Record<string, unknown>;
  }>('/cosmetics/me');
}

export function equipCosmetic(slot: string, itemId: string | null) {
  return apiFetch<{
    slot: string;
    item: CosmeticItem | null;
    replayed: boolean;
  }>(`/cosmetics/equipment/${encodeURIComponent(slot)}`, {
    method: 'PUT',
    body: JSON.stringify({ itemId })
  });
}

export function fetchCosmeticShop() {
  return apiFetch<{
    offers: CosmeticOffer[];
    wallet: { balance: number; version: number; updatedAt: string };
    rules: Record<string, unknown>;
    serverTime: string;
  }>('/cosmetics/shop');
}

export function purchaseCosmetic(offerId: string, clientPurchaseId: string) {
  return apiFetch<{
    receipt: CosmeticPurchaseReceipt;
    ownership: CosmeticOwnership;
    ledgerEntry: {
      id: string;
      amount: number;
      balanceBefore: number;
      balanceAfter: number;
    };
    replayed: boolean;
    rules: Record<string, unknown>;
  }>('/cosmetics/shop/purchases', {
    method: 'POST',
    body: JSON.stringify({ offerId, clientPurchaseId })
  });
}

export function fetchCosmeticPurchaseHistory() {
  return apiFetch<{
    receipts: CosmeticPurchaseReceipt[];
    rules: Record<string, unknown>;
  }>('/cosmetics/shop/purchases');
}

export function fetchPublicCosmetics(username: string) {
  return apiFetch<PublicCosmeticSnapshot>(
    `/cosmetics/public/${encodeURIComponent(username)}`
  );
}

export function updateCosmeticPrivacy(
  cosmeticVisibility: CosmeticPrivacyPreferences['cosmeticVisibility'],
  hiddenCosmeticSlots: string[]
) {
  return apiFetch<CosmeticPrivacyPreferences>('/privacy/preferences', {
    method: 'PATCH',
    body: JSON.stringify({ cosmeticVisibility, hiddenCosmeticSlots })
  });
}

export function fetchCosmeticPresets() {
  return apiFetch<{
    presets: CosmeticPreset[];
    state: CosmeticPresetState;
    maintenance: { removedInvalidItems: number };
    rules: Record<string, unknown>;
  }>('/cosmetics/presets');
}

export function createCosmeticPreset(
  name: string,
  items: CosmeticPresetInput[],
  setAsDefault = false
) {
  return apiFetch<{ preset: CosmeticPreset; rules: Record<string, unknown> }>(
    '/cosmetics/presets',
    {
      method: 'POST',
      body: JSON.stringify({ name, items, setAsDefault })
    }
  );
}

export function updateCosmeticPreset(
  presetId: string,
  input: { name?: string; items?: CosmeticPresetInput[]; setAsDefault?: boolean }
) {
  return apiFetch<{ preset: CosmeticPreset; rules: Record<string, unknown> }>(
    `/cosmetics/presets/${encodeURIComponent(presetId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input)
    }
  );
}

export function previewCosmeticPreset(presetId: string) {
  return apiFetch<{
    preset: CosmeticPreset;
    preview: Array<{
      slot: string;
      item: CosmeticItem;
      applicable: boolean;
      blockedReason: 'HIDDEN_SLOT' | null;
    }>;
    maintenance: { removedInvalidItems: number };
    rules: Record<string, unknown>;
  }>(`/cosmetics/presets/${encodeURIComponent(presetId)}/preview`);
}

export function activateCosmeticPreset(presetId: string, idempotencyKey: string) {
  return apiFetch<{
    state?: CosmeticPresetState;
    equipment: CosmeticEquipment[] | Record<string, unknown>;
    maintenance?: {
      prunedInvalidItems: number;
      skippedHiddenSlots: string[];
    };
    replayed: boolean;
    rules: Record<string, unknown>;
  }>(`/cosmetics/presets/${encodeURIComponent(presetId)}/activate`, {
    method: 'POST',
    body: JSON.stringify({ idempotencyKey })
  });
}

export function setDefaultCosmeticPreset(presetId: string) {
  return apiFetch<{
    defaultPresetId: string;
    activationVersion: number;
    rules: Record<string, unknown>;
  }>(`/cosmetics/presets/${encodeURIComponent(presetId)}/default`, {
    method: 'POST'
  });
}

export function deleteCosmeticPreset(presetId: string) {
  return apiFetch<{ deleted: boolean; presetId: string }>(
    `/cosmetics/presets/${encodeURIComponent(presetId)}`,
    { method: 'DELETE' }
  );
}
