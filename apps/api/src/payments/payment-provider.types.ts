export const PAYMENT_PROVIDERS = [
  'FLUTTERWAVE',
  'CINETPAY',
  'GOOGLE_PLAY',
  'APPLE_APP_STORE'
] as const;

export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];
export type PaymentPlatform = 'WEB' | 'ANDROID' | 'IOS';
export type VerifiedPaymentStatus =
  | 'SUCCESS'
  | 'PENDING'
  | 'FAILED'
  | 'CANCELED'
  | 'REFUNDED';

export type CheckoutCustomer = {
  id: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  address?: string;
  city?: string;
  countryCode?: string;
  state?: string;
  postalCode?: string;
};

export type CreateProviderCheckoutInput = {
  reference: string;
  amount: number;
  currency: string;
  description: string;
  returnUrl: string;
  notifyUrl: string;
  customer: CheckoutCustomer;
  metadata: Record<string, string>;
};

export type ProviderCheckoutResult = {
  providerCheckoutId: string | null;
  checkoutUrl: string;
  raw: Record<string, unknown>;
};

export type VerifyProviderPaymentInput = {
  externalTransactionId: string;
  expectedReference: string;
  expectedAmount: number;
  expectedCurrency: string;
};

export type VerifiedProviderPayment = {
  status: VerifiedPaymentStatus;
  externalTransactionId: string;
  externalEventId?: string;
  reference: string;
  amount: number;
  currency: string;
  paidAt?: Date;
  paymentMethod?: string;
  rawStatus: string;
  raw: Record<string, unknown>;
};

export type RefundProviderPaymentInput = {
  externalTransactionId: string;
  amount: number;
  reason: string;
  callbackUrl?: string;
};

export type ProviderRefundResult = {
  externalRefundId: string;
  status: string;
  raw: Record<string, unknown>;
};

export type StorePurchaseVerificationInput = {
  externalProductId: string;
  purchaseToken?: string;
  transactionId?: string;
  expectedAccountReference: string;
  kind: 'SUBSCRIPTION' | 'ONE_TIME';
};

export type VerifiedStorePurchase = {
  status: VerifiedPaymentStatus;
  externalTransactionId: string;
  externalSubscriptionId?: string;
  externalProductId: string;
  accountReference?: string;
  regionCode?: string;
  purchasedAt: Date;
  periodStart?: Date;
  periodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  rawStatus: string;
  raw: Record<string, unknown>;
};

export type ParsedProviderWebhook = {
  externalEventId: string;
  externalTransactionId?: string;
  reference?: string;
  eventType: string;
  raw: Record<string, unknown>;
};
