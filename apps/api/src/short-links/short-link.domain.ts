import { randomBytes } from 'crypto';
import {
  isKnowMeDeepLinkKind,
  isSafeKnowMeLinkIdentifier,
  KnowMeDeepLinkKind
} from '@knowme/link-contract';

export const SHORT_LINK_CODE_BYTES = 12;
export const SHORT_LINK_MAX_TTL_DAYS = 90;
export const SHORT_LINK_MAX_TTL_MS = SHORT_LINK_MAX_TTL_DAYS * 24 * 60 * 60 * 1_000;

const SHORT_CODE_PATTERN = /^[A-Za-z0-9_-]{16}$/;

export type ShortLinkTarget = {
  kind: KnowMeDeepLinkKind;
  id: string;
};

export function generateShortLinkCode(): string {
  return randomBytes(SHORT_LINK_CODE_BYTES).toString('base64url');
}

export function isValidShortLinkCode(value: string): boolean {
  return SHORT_CODE_PATTERN.test(value);
}

export function assertShortLinkTarget(kind: string, id: string): ShortLinkTarget {
  if (!isKnowMeDeepLinkKind(kind)) {
    throw new Error('SHORT_LINK_KIND_UNSUPPORTED');
  }
  if (!isSafeKnowMeLinkIdentifier(id)) {
    throw new Error('SHORT_LINK_TARGET_INVALID');
  }
  return { kind, id };
}

export function normalizeShortLinkExpiry(
  expiresAt: Date | null | undefined,
  now = new Date()
): Date | null {
  if (!expiresAt) return null;
  const value = expiresAt.getTime();
  const current = now.getTime();

  if (!Number.isFinite(value) || value <= current) {
    throw new Error('SHORT_LINK_EXPIRY_INVALID');
  }
  if (value - current > SHORT_LINK_MAX_TTL_MS) {
    throw new Error('SHORT_LINK_EXPIRY_TOO_FAR');
  }

  return expiresAt;
}

export function isShortLinkActive(
  link: { expiresAt: Date | null; revokedAt: Date | null },
  now = new Date()
): boolean {
  if (link.revokedAt) return false;
  return !link.expiresAt || link.expiresAt.getTime() > now.getTime();
}
