import { apiFetch } from './api';

export type Entitlement = {
  id: string;
  key: string;
  source: string;
  startsAt: string;
  expiresAt: string | null;
};

export type EntitlementResponse = {
  accountId: string;
  serverTime: string;
  entitlements: Entitlement[];
};

export async function fetchEntitlements() {
  return apiFetch<EntitlementResponse>('/entitlements/me');
}

export async function hasEntitlement(key: string) {
  const response = await fetchEntitlements();
  const normalized = key.trim().toLowerCase();
  return response.entitlements.some((item) => item.key === normalized);
}
