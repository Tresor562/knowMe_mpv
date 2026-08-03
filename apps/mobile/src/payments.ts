import { Platform } from 'react-native';
import { apiFetch } from './api';
import { NativePurchaseProof, NativeStoreProvider, mobileStoreProvider } from './native-purchases';

export type MobilePaymentPlatform = 'ANDROID' | 'IOS';

export type MobileCommercePrice = {
  id: string;
  provider: NativeStoreProvider;
  platform: MobilePaymentPlatform;
  countryCode: string | null;
  currency: string;
  unitAmount: number;
  externalProductId: string | null;
};

export type MobileCommerceProduct = {
  key: string;
  name: string;
  description: string | null;
  kind: string;
  highlighted: boolean;
  requiresVerification: boolean;
  requiresManualReview: boolean;
  prices: MobileCommercePrice[];
};

export type MobilePaymentOrder = {
  id: string;
  productKey: string;
  productName: string;
  provider: string;
  platform: string;
  status: string;
  expectedAmount: number;
  currency: string;
  reference: string;
  fulfilledAt: string | null;
  failureCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MobilePaymentOrderPage = {
  items: MobilePaymentOrder[];
  nextCursor: string | null;
};

export type MobileProviderConfiguration = {
  providers: Record<
    'FLUTTERWAVE' | 'CINETPAY' | 'GOOGLE_PLAY' | 'APPLE_APP_STORE',
    { configured: boolean; platform: 'WEB' | 'ANDROID' | 'IOS' }
  >;
  pricesAreServerAuthoritative: true;
  clientAmountsAccepted: false;
  rawPaymentCredentialsStored: false;
  storeProofsEncryptedAtRest: true;
};

export type StoreAccountReference = {
  provider: NativeStoreProvider;
  accountReference: string;
};

export type StoreVerificationResponse = {
  order: MobilePaymentOrder;
  replayed: boolean;
  fulfillment?: unknown;
};

export function mobilePaymentPlatform(): MobilePaymentPlatform | null {
  if (Platform.OS === 'android') return 'ANDROID';
  if (Platform.OS === 'ios') return 'IOS';
  return null;
}

export async function getMobilePaymentCatalog() {
  const platform = mobilePaymentPlatform();
  if (!platform) return [];
  return apiFetch<MobileCommerceProduct[]>(`/payments/catalog?platform=${platform}`);
}

export function getMobilePaymentProviders() {
  return apiFetch<MobileProviderConfiguration>('/payments/providers');
}

export async function getStoreAccountReference() {
  const provider = mobileStoreProvider();
  if (!provider) throw new Error('Aucune boutique native n’est disponible sur cette plateforme.');
  return apiFetch<StoreAccountReference>(
    `/payments/store/account-reference?provider=${provider}`
  );
}

export function getMobilePaymentOrders(limit = 20) {
  return apiFetch<MobilePaymentOrderPage>(`/payments/me/orders?limit=${limit}`);
}

export function verifyNativePurchase(productKey: string, proof: NativePurchaseProof) {
  return apiFetch<StoreVerificationResponse>('/payments/store/verify', {
    method: 'POST',
    body: JSON.stringify({ productKey, ...proof })
  });
}

const ZERO_DECIMAL = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'ISK',
  'JPY',
  'KMF',
  'KRW',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF'
]);
const THREE_DECIMAL = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);

function exponent(currency: string) {
  const normalized = currency.toUpperCase();
  if (ZERO_DECIMAL.has(normalized)) return 0;
  if (THREE_DECIMAL.has(normalized)) return 3;
  return 2;
}

export function formatMobileMinorAmount(amount: number, currency: string) {
  const normalized = currency.toUpperCase();
  const decimals = exponent(normalized);
  const value = amount / 10 ** decimals;
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: normalized,
      maximumFractionDigits: decimals
    }).format(value);
  } catch {
    return `${value.toFixed(decimals)} ${normalized}`;
  }
}

export function mobilePaymentStatus(status: string) {
  const labels: Record<string, string> = {
    CREATED: 'Créée',
    PENDING: 'En attente',
    PAID: 'Payée',
    FULFILLED: 'Livrée',
    FAILED: 'Échouée',
    INIT_FAILED: 'Initialisation échouée',
    CANCELED: 'Annulée',
    REFUNDED: 'Remboursée',
    REVIEW_REQUIRED: 'Vérification requise'
  };
  return labels[status] ?? status.replaceAll('_', ' ');
}
