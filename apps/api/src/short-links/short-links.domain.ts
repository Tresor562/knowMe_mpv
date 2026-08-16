import { BadRequestException } from '@nestjs/common';
import {
  buildKnowMeDeepLink,
  buildKnowMeUniversalPath,
  isKnowMeDeepLinkKind,
  isSafeKnowMeLinkIdentifier,
  KNOWME_DEEP_LINK_KINDS,
  KnowMeDeepLinkKind
} from '@knowme/link-contract';

export const SHORT_LINK_KINDS = [...KNOWME_DEEP_LINK_KINDS] as const;
const CODE_PATTERN = /^[A-Za-z0-9_-]{16}$/;

export function assertShortLinkKind(value: string): KnowMeDeepLinkKind {
  if (!isKnowMeDeepLinkKind(value)) {
    throw new BadRequestException('Type de destination de lien non pris en charge.');
  }
  return value;
}

export function normalizeTargetId(value: string) {
  const targetId = value.trim();
  if (!isSafeKnowMeLinkIdentifier(targetId)) {
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

export function buildShortLinkDestination(kind: KnowMeDeepLinkKind, targetId: string) {
  const id = normalizeTargetId(targetId);
  return {
    universalPath: buildKnowMeUniversalPath({ kind, id }),
    deepLink: buildKnowMeDeepLink({ kind, id })
  };
}

export function shortLinkPolicy() {
  return {
    codeAlphabet: 'base64url',
    codeEntropyBytes: 12,
    targetKinds: [...SHORT_LINK_KINDS],
    contractVersion: 'v1',
    arbitraryExternalUrlsAllowed: false,
    rawIpAnalyticsStored: false,
    publicResolutionRevealsOwner: false,
    publicResolutionRevealsTargetId: false,
    authorizationRevalidatedOnResolve: true,
    creationFeatureFlag: 'short_links.creation'
  } as const;
}
