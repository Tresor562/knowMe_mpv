'use client';

import { apiFetch } from './api';

export type WebPaymentProvider = 'FLUTTERWAVE' | 'CINETPAY';
export type StorePaymentProvider = 'GOOGLE_PLAY' | 'APPLE_APP_STORE';
export type PaymentProvider = WebPaymentProvider | StorePaymentProvider;
export type PaymentPlatform = 'WEB' | 'ANDROID' | 'IOS';

export type CommercePrice = {
  id: string;
  provider: PaymentProvider;
  platform: PaymentPlatform;
  countryCode: string | null;
  currency: string;
  unitAmount: number;
  externalProductId: string | null;
};

export type CommerceProduct = {
  key: string;
  name: string;
  description: string | null;
  kind: string;
  highlighted: boolean;
  requiresVerification: boolean;
  requiresManualReview: boolean;
  prices: CommercePrice[];
};

export type ProviderConfiguration = {
  configured: boolean;
  platform: PaymentPlatform;
};

export type PaymentProviderConfiguration = {
  providers: Record<PaymentProvider, ProviderConfiguration>;
  pricesAreServerAuthoritative: true;
  clientAmountsAccepted: false;
  rawPaymentCredentialsStored: false;
  storeProofsEncryptedAtRest: true;
};

export type PaymentAttempt = {
  id: string;
  status: string;
  rawStatus: string | null;
  verifiedAt: string | null;
  createdAt: string;
};

export type PaymentRefund = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
};

export type PaymentInvoice = {
  number: string;
  status: string;
  total: number;
  currency: string;
  issuedAt: string;
  paidAt: string | null;
  refundedAt: string | null;
};

export type PaymentOrder = {
  id: string;
  productKey: string;
  productName: string;
  provider: PaymentProvider;
  platform: PaymentPlatform;
  status: string;
  expectedAmount: number;
  currency: string;
  countryCode: string | null;
  reference: string;
  checkoutUrl: string | null;
  expiresAt: string;
  fulfilledAt: string | null;
  failureCode: string | null;
  invoice: PaymentInvoice | null;
  attempts?: PaymentAttempt[];
  refunds?: PaymentRefund[];
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentOrderPage = {
  items: PaymentOrder[];
  nextCursor: string | null;
};

export type PaymentOrderReference = {
  id: string;
  reference: string;
};

export type CreateWebCheckoutInput = {
  productKey: string;
  provider: WebPaymentProvider;
  countryCode?: string;
  currency?: string;
  phoneNumber?: string;
  address?: string;
  city?: string;
  customerCountryCode?: string;
  state?: string;
  postalCode?: string;
};

export type CheckoutResponse = {
  order: PaymentOrder;
  replayed: boolean;
};

export type VerificationResponse = {
  order: PaymentOrder;
  fulfillment?: unknown;
};

function clean(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function paymentsCatalogPath(input: {
  platform: PaymentPlatform;
  country?: string;
  currency?: string;
}) {
  const query = new URLSearchParams({ platform: input.platform });
  const country = clean(input.country)?.toUpperCase();
  const currency = clean(input.currency)?.toUpperCase();
  if (country) query.set('country', country);
  if (currency) query.set('currency', currency);
  return `/payments/catalog?${query.toString()}`;
}

export function getPaymentCatalog(input: {
  platform: PaymentPlatform;
  country?: string;
  currency?: string;
}) {
  return apiFetch<CommerceProduct[]>(paymentsCatalogPath(input));
}

export function getPaymentProviders() {
  return apiFetch<PaymentProviderConfiguration>('/payments/providers');
}

export function getPaymentOrders(cursor?: string, limit = 30) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set('cursor', cursor);
  return apiFetch<PaymentOrderPage>(`/payments/me/orders?${query.toString()}`);
}

export function getPaymentOrder(orderId: string) {
  return apiFetch<PaymentOrder>(`/payments/me/orders/${encodeURIComponent(orderId)}`);
}

export function resolvePaymentOrderReference(reference: string) {
  return apiFetch<PaymentOrderReference>(
    `/payments/me/order-references/${encodeURIComponent(reference.trim().toUpperCase())}`
  );
}

export function createWebCheckout(
  input: CreateWebCheckoutInput,
  idempotencyKey: string
) {
  return apiFetch<CheckoutResponse>('/payments/checkout', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input)
  });
}

export function verifyWebPayment(orderId: string, externalTransactionId: string) {
  return apiFetch<VerificationResponse>(
    `/payments/orders/${encodeURIComponent(orderId)}/verify`,
    {
      method: 'POST',
      body: JSON.stringify({ externalTransactionId: externalTransactionId.trim() })
    }
  );
}

export function createCheckoutIdempotencyKey(
  productKey: string,
  provider: WebPaymentProvider
) {
  const nonce = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
  return `checkout:${provider.toLowerCase()}:${productKey}:${nonce}`.slice(0, 160);
}

const ZERO_DECIMAL_CURRENCIES = new Set([
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
const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);

export function currencyExponent(currency: string) {
  const normalized = currency.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(normalized)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(normalized)) return 3;
  return 2;
}

export function formatMinorAmount(amount: number, currency: string) {
  const normalizedCurrency = currency.toUpperCase();
  const value = amount / 10 ** currencyExponent(normalizedCurrency);
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: normalizedCurrency,
      maximumFractionDigits: currencyExponent(normalizedCurrency)
    }).format(value);
  } catch {
    return `${value.toFixed(currencyExponent(normalizedCurrency))} ${normalizedCurrency}`;
  }
}

export function paymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    CREATED: 'Créée',
    PENDING: 'En attente',
    PAID: 'Payée',
    FULFILLED: 'Livrée',
    FAILED: 'Échouée',
    INIT_FAILED: 'Initialisation échouée',
    CANCELED: 'Annulée',
    REFUNDED: 'Remboursée',
    PARTIALLY_REFUNDED: 'Partiellement remboursée',
    REVIEW_REQUIRED: 'Vérification requise'
  };
  return labels[status] ?? status.replaceAll('_', ' ');
}

export function paymentStatusTone(status: string) {
  if (['PAID', 'FULFILLED'].includes(status)) return 'var(--mint)';
  if (['FAILED', 'INIT_FAILED', 'CANCELED'].includes(status)) return 'var(--orange)';
  if (['REFUNDED', 'PARTIALLY_REFUNDED', 'REVIEW_REQUIRED'].includes(status)) {
    return '#f4c95d';
  }
  return 'var(--muted)';
}
