import {
  createHash,
  createHmac,
  createPrivateKey,
  sign,
  timingSafeEqual
} from 'crypto';

export function sha256Hex(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

export function hmacSha256Hex(secret: string, value: string | Buffer) {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function hmacSha256Base64(secret: string, value: string | Buffer) {
  return createHmac('sha256', secret).update(value).digest('base64');
}

export function constantTimeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function decodeBase64UrlJson<T>(value: string): T {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  return JSON.parse(Buffer.from(normalized + padding, 'base64').toString('utf8')) as T;
}

export function signJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  privateKeyPem: string,
  algorithm: 'RS256' | 'ES256'
) {
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = createPrivateKey(privateKeyPem.replace(/\\n/g, '\n'));
  const signature = sign(
    algorithm === 'RS256' ? 'RSA-SHA256' : 'sha256',
    Buffer.from(signingInput),
    algorithm === 'ES256'
      ? { key, dsaEncoding: 'ieee-p1363' }
      : key
  );
  return `${signingInput}.${base64Url(signature)}`;
}
