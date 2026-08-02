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
