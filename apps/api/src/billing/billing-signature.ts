import { createHash, createHmac, timingSafeEqual } from 'crypto';

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalize(entry)])
    );
  }
  return value;
}

export function canonicalBillingPayload(value: unknown) {
  return JSON.stringify(normalize(value));
}

export function billingPayloadHash(value: unknown) {
  return createHash('sha256')
    .update(canonicalBillingPayload(value), 'utf8')
    .digest('hex');
}

export function signBillingPayload(
  secret: string,
  timestamp: string,
  value: unknown
) {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${canonicalBillingPayload(value)}`, 'utf8')
    .digest('hex');
}

export function secureSignatureEquals(expected: string, received: string) {
  if (!/^[a-f0-9]{64}$/i.test(received)) return false;
  const left = Buffer.from(expected, 'hex');
  const right = Buffer.from(received, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}
