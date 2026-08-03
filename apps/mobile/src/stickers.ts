import { apiFetch } from './api';

export type MobileSticker = {
  key: string;
  version: number;
  name: string;
  emoji: string;
  altText: string;
  assetToken: string;
  active: boolean;
};

export type MobileStickerPack = {
  key: string;
  version: number;
  name: string;
  description: string;
  coverEmoji: string;
  free: true;
  active: boolean;
  stickers: MobileSticker[];
};

export type MobileStickerCatalog = {
  schemaVersion: 1;
  packs: MobileStickerPack[];
  policy: {
    freeStarterLibrary: true;
    signedMessagesRequired: true;
    arbitraryAssetsAllowed: false;
    arbitraryHtmlAllowed: false;
    visualOnly: true;
  };
};

export type MobileResolvedSticker = {
  payload: {
    conversationId: string;
    packKey: string;
    stickerKey: string;
  };
  pack: {
    key: string;
    version: number;
    name: string;
  };
  sticker: MobileSticker;
  visualOnly: true;
  externalAssetAllowed: false;
  arbitraryHtmlAllowed: false;
};

function webBaseUrl() {
  const value = process.env.EXPO_PUBLIC_WEB_URL?.trim().replace(/\/$/, '');
  if (!value) throw new Error('EXPO_PUBLIC_WEB_URL est requis pour les stickers signés.');
  return value;
}

async function jsonRequest<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${webBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });
  const data = (await response.json()) as T | { message?: string };
  if (!response.ok) {
    throw new Error(
      typeof data === 'object' && data && 'message' in data && data.message
        ? data.message
        : 'Service de stickers indisponible.'
    );
  }
  return data as T;
}

export function getMobileStickerCatalog() {
  return jsonRequest<MobileStickerCatalog>('/api/stickers/catalog', {
    method: 'GET'
  });
}

export function mintMobileStickerToken(input: {
  packKey: string;
  stickerKey: string;
  conversationId: string;
}) {
  return jsonRequest<{ token: string; visualOnly: true; clientAssetAccepted: false }>(
    '/api/stickers/token',
    {
      method: 'POST',
      body: JSON.stringify(input)
    }
  );
}

export async function sendMobileSticker(input: {
  packKey: string;
  stickerKey: string;
  conversationId: string;
}) {
  const signed = await mintMobileStickerToken(input);
  return apiFetch(`/conversations/${encodeURIComponent(input.conversationId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content: signed.token })
  });
}

export function resolveMobileSticker(token: string) {
  return jsonRequest<MobileResolvedSticker>('/api/stickers/resolve', {
    method: 'POST',
    body: JSON.stringify({ token })
  });
}
