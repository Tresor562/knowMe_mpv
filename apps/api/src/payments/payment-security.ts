import { randomBytes } from 'crypto';
import { sha256Hex } from './payment-crypto';
import { PaymentProvider } from './payment-provider.types';

const SENSITIVE_KEYS = /secret|authorization|token|key|password|pan|card|cvv|cvc|phone|email|address/i;

export function paymentAccountReference(
  userId: string,
  provider: PaymentProvider
) {
  const digest = sha256Hex(`knowme-payment-account:${provider}:${userId}`);
  if (provider === 'APPLE_APP_STORE') {
    const bytes = Buffer.from(digest.slice(0, 32), 'hex');
    bytes[6] = (bytes[6]! & 0x0f) | 0x50;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return digest;
}

export function createPaymentReference(provider: PaymentProvider) {
  const prefix = provider === 'FLUTTERWAVE'
    ? 'FLW'
    : provider === 'CINETPAY'
      ? 'CNP'
      : provider === 'GOOGLE_PLAY'
        ? 'GPL'
        : 'APL';
  return `KM-${prefix}-${Date.now().toString(36).toUpperCase()}-${randomBytes(8).toString('hex').toUpperCase()}`;
}

export function redactPaymentPayload(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[TRUNCATED]';
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((entry) => redactPaymentPayload(entry, depth + 1));
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && value.length > 2_000) {
      return `${value.slice(0, 2_000)}…`;
    }
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 200)
      .map(([key, entry]) => [
        key,
        SENSITIVE_KEYS.test(key)
          ? '[REDACTED]'
          : redactPaymentPayload(entry, depth + 1)
      ])
  );
}

export function hashNetworkValue(value: string | undefined, salt: string) {
  return value ? sha256Hex(`${salt}:${value}`) : null;
}
