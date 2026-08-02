'use client';

import { apiFetch } from './api';

export type StoreProduct = {
  id: string;
  key: string;
  provider: 'APPLE' | 'GOOGLE';
  platform: 'ANDROID' | 'IOS';
  externalProductId: string;
  name: string;
  description?: string | null;
  kind: 'ENTITLEMENT' | 'KNOWCOINS';
  entitlementKey?: string | null;
  coinAmount?: number | null;
  durationDays?: number | null;
};

export type PurchaseHistoryItem = {
  id: string;
  provider: string;
  platform: string;
  transactionId: string;
  status: string;
  purchasedAt: string;
  expiresAt?: string | null;
  verifiedAt: string;
  product: { key: string; name: string; kind: string };
};

export function fetchStoreProducts() {
  return apiFetch<StoreProduct[]>('/purchases/products');
}

export function fetchPurchaseHistory() {
  return apiFetch<PurchaseHistoryItem[]>('/purchases/me');
}
