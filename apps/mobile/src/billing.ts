import { apiFetch } from './api';

export type MobileBillingPrice = {
  id: string;
  provider: string;
  platform: string;
  countryCode?: string | null;
  currency: string;
  unitAmount: number;
  interval: string;
  intervalCount: number;
};

export type MobileBillingPlan = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  highlighted: boolean;
  requiresVerification: boolean;
  requiresManualReview: boolean;
  entitlements: string[];
  prices: MobileBillingPrice[];
  checkoutAvailable: boolean;
};

export type MobileBillingSubscription = {
  id: string;
  status: string;
  provider: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  grantsAccess: boolean;
  entitlementKeys: string[];
  plan: { key: string; name: string };
};

export type MobileBillingState = {
  accountId: string;
  serverTime: string;
  subscriptions: MobileBillingSubscription[];
  entitlements: Array<{
    id: string;
    key: string;
    source: string;
    startsAt: string;
    expiresAt?: string | null;
  }>;
};

export function fetchMobileBillingCatalog(
  platform: 'ANDROID' | 'IOS' = 'ANDROID',
  countryCode?: string,
  currency?: string
) {
  const params = new URLSearchParams({ platform });
  if (countryCode) params.set('country', countryCode.toUpperCase());
  if (currency) params.set('currency', currency.toUpperCase());
  return apiFetch<MobileBillingPlan[]>(`/billing/plans?${params.toString()}`);
}

export function fetchMobileBillingState() {
  return apiFetch<MobileBillingState>('/billing/me');
}

export function hasActiveBillingEntitlement(
  state: MobileBillingState,
  key: string
) {
  const normalized = key.trim().toLowerCase();
  return state.entitlements.some((item) => item.key === normalized);
}
