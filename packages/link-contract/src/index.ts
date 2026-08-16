export const KNOWME_DEEP_LINK_SCHEME = 'knowme';
export const KNOWME_DEEP_LINK_VERSION = 'v1';

export const KNOWME_DEEP_LINK_KINDS = [
  'profile',
  'challenge',
  'community',
  'event',
  'gift',
  'sticker-pack'
] as const;

export type KnowMeDeepLinkKind = (typeof KNOWME_DEEP_LINK_KINDS)[number];

export type KnowMeDeepLinkTarget = {
  kind: KnowMeDeepLinkKind;
  id: string;
};

export type ParsedKnowMeDeepLink = KnowMeDeepLinkTarget & {
  version: typeof KNOWME_DEEP_LINK_VERSION;
};

const IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;
const KIND_SET = new Set<string>(KNOWME_DEEP_LINK_KINDS);

export function isKnowMeDeepLinkKind(value: string): value is KnowMeDeepLinkKind {
  return KIND_SET.has(value);
}

export function isSafeKnowMeLinkIdentifier(value: string): boolean {
  return IDENTIFIER_PATTERN.test(value);
}

export function assertKnowMeDeepLinkTarget(
  target: KnowMeDeepLinkTarget
): KnowMeDeepLinkTarget {
  if (!isKnowMeDeepLinkKind(target.kind)) {
    throw new Error('KNOWME_LINK_KIND_UNSUPPORTED');
  }

  if (!isSafeKnowMeLinkIdentifier(target.id)) {
    throw new Error('KNOWME_LINK_IDENTIFIER_INVALID');
  }

  return target;
}

export function buildKnowMeDeepLink(target: KnowMeDeepLinkTarget): string {
  assertKnowMeDeepLinkTarget(target);
  return `${KNOWME_DEEP_LINK_SCHEME}://${KNOWME_DEEP_LINK_VERSION}/${target.kind}/${target.id}`;
}

export function buildKnowMeUniversalPath(target: KnowMeDeepLinkTarget): string {
  assertKnowMeDeepLinkTarget(target);
  return `/open/${KNOWME_DEEP_LINK_VERSION}/${target.kind}/${target.id}`;
}

export function parseKnowMeDeepLink(value: string): ParsedKnowMeDeepLink | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== `${KNOWME_DEEP_LINK_SCHEME}:`) return null;
  if (url.hostname !== KNOWME_DEEP_LINK_VERSION) return null;
  if (url.username || url.password || url.port || url.search || url.hash) return null;

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length !== 2) return null;

  const [kind, id] = segments;
  if (!kind || !id || !isKnowMeDeepLinkKind(kind)) return null;
  if (!isSafeKnowMeLinkIdentifier(id)) return null;

  return {
    version: KNOWME_DEEP_LINK_VERSION,
    kind,
    id
  };
}

export function parseKnowMeUniversalPath(
  value: string
): ParsedKnowMeDeepLink | null {
  const pathname = value.split(/[?#]/, 1)[0] ?? '';
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length !== 4 || segments[0] !== 'open') return null;
  if (segments[1] !== KNOWME_DEEP_LINK_VERSION) return null;

  const kind = segments[2];
  const id = segments[3];
  if (!kind || !id || !isKnowMeDeepLinkKind(kind)) return null;
  if (!isSafeKnowMeLinkIdentifier(id)) return null;

  return {
    version: KNOWME_DEEP_LINK_VERSION,
    kind,
    id
  };
}
