import { BadRequestException } from '@nestjs/common';

export const SHORT_LINK_TARGET_TYPES = [
  'PROFILE',
  'CHALLENGE',
  'GROUP',
  'COMMUNITY',
  'EVENT',
  'GIFT',
  'STICKER_PACK'
] as const;

export type ShortLinkTargetType = (typeof SHORT_LINK_TARGET_TYPES)[number];

const TARGET_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/;
const CODE_PATTERN = /^[A-Za-z0-9_-]{10,20}$/;

const WEB_PREFIX: Record<ShortLinkTargetType, string> = {
  PROFILE: '/profile',
  CHALLENGE: '/challenges',
  GROUP: '/messages',
  COMMUNITY: '/circles',
  EVENT: '/events',
  GIFT: '/gifts',
  STICKER_PACK: '/stickers'
};

const DEEP_LINK_PREFIX: Record<ShortLinkTargetType, string> = {
  PROFILE: 'profile',
  CHALLENGE: 'challenge',
  GROUP: 'messages',
  COMMUNITY: 'community',
  EVENT: 'event',
  GIFT: 'gift',
  STICKER_PACK: 'sticker-pack'
};

export function assertShortLinkTargetType(value: string): ShortLinkTargetType {
  if (!SHORT_LINK_TARGET_TYPES.includes(value as ShortLinkTargetType)) {
    throw new BadRequestException('Type de destination de lien non pris en charge.');
  }
  return value as ShortLinkTargetType;
}

export function normalizeTargetId(value: string) {
  const targetId = value.trim();
  if (!TARGET_PATTERN.test(targetId)) {
    throw new BadRequestException('Destination de lien invalide.');
  }
  return targetId;
}

export function normalizeShortCode(value: string) {
  const code = value.trim();
  if (!CODE_PATTERN.test(code)) {
    throw new BadRequestException('Code de lien invalide.');
  }
  return code;
}

export function buildShortLinkDestination(type: ShortLinkTargetType, targetId: string) {
  const safeId = normalizeTargetId(targetId);
  const encoded = encodeURIComponent(safeId);

  if (type === 'GIFT') {
    return {
      webPath: `${WEB_PREFIX[type]}?gift=${encoded}`,
      deepLink: `knowme://${DEEP_LINK_PREFIX[type]}/${encoded}`
    };
  }

  if (type === 'STICKER_PACK') {
    return {
      webPath: `${WEB_PREFIX[type]}?pack=${encoded}`,
      deepLink: `knowme://${DEEP_LINK_PREFIX[type]}/${encoded}`
    };
  }

  return {
    webPath: `${WEB_PREFIX[type]}/${encoded}`,
    deepLink: `knowme://${DEEP_LINK_PREFIX[type]}/${encoded}`
  };
}

export function shortLinkPolicy() {
  return {
    codeAlphabet: 'base64url',
    codeEntropyBytes: 12,
    targetTypes: [...SHORT_LINK_TARGET_TYPES],
    arbitraryExternalUrlsAllowed: false,
    rawIpAnalyticsStored: false,
    publicResolutionRevealsOwner: false,
    creationFeatureFlag: 'short_links.creation'
  } as const;
}
