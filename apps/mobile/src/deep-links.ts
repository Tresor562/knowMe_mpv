import {
  KNOWME_PUBLIC_LINK_ORIGIN,
  ParsedKnowMeDeepLink,
  parseKnowMeDeepLink,
  parseKnowMeUniversalPath
} from '@knowme/link-contract';

export type MobileDeepLinkResolution = {
  target: ParsedKnowMeDeepLink;
  source: 'scheme' | 'universal-path';
};

export function resolveIncomingKnowMeLink(
  value: string
): MobileDeepLinkResolution | null {
  const schemeTarget = parseKnowMeDeepLink(value);
  if (schemeTarget) {
    return { target: schemeTarget, source: 'scheme' };
  }

  let pathname = value;
  try {
    const url = new URL(value);
    // External sites must not be able to impersonate KnowMe links.
    if (url.protocol !== 'https:' || url.origin !== KNOWME_PUBLIC_LINK_ORIGIN) return null;
    pathname = url.pathname;
  } catch {
    // A relative universal path is also accepted for local routing/tests.
  }

  const universalTarget = parseKnowMeUniversalPath(pathname);
  return universalTarget
    ? { target: universalTarget, source: 'universal-path' }
    : null;
}
