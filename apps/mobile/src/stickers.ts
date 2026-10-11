import { apiFetch } from './api';

export type MobileSticker = {
  key: string;
  version: number;
  label: string;
  glyph: string;
  accessibilityLabel: string;
};

export type MobileStickerPack = {
  key: string;
  version: number;
  name: string;
  description: string;
  stickers: MobileSticker[];
};

export type MobileStickerCatalog = {
  schemaVersion: 1;
  packs: MobileStickerPack[];
  visualOnly: true;
  externalAssetAllowed: false;
  arbitraryHtmlAllowed: false;
  clientAssetAccepted: false;
};

export type MobileStickerPresentation = {
  kind: 'STICKER';
  pack: { key: string; version: number; name: string };
  sticker: MobileSticker;
  issuedAt: string;
  expiresAt: string;
  visualOnly: true;
  externalAssetAllowed: false;
  arbitraryHtmlAllowed: false;
};

export type MobileMessagePresentation =
  | MobileStickerPresentation
  | { kind: 'TEXT'; text: string }
  | {kind:'GIF'|'STICKER_IMAGE'|'IMAGE'|'VIDEO'|'AUDIO'|'DOCUMENT';assetId:string;mimeType:string};

export function getMobileStickerCatalog() {
  return apiFetch<MobileStickerCatalog>('/stickers/catalog');
}

export function sendMobileSticker<T>(input: {
  packKey: string;
  stickerKey: string;
  conversationId: string;
}) {
  return apiFetch<T>(
    `/conversations/${encodeURIComponent(input.conversationId)}/stickers`,
    {
      method: 'POST',
      body: JSON.stringify({
        packKey: input.packKey,
        stickerKey: input.stickerKey
      })
    }
  );
}

export function mobileMessagePreview(input: {
  content: string;
  presentation?: MobileMessagePresentation;
}) {
  return input.presentation?.kind === 'STICKER'
    ? `${input.presentation.sticker.glyph} ${input.presentation.sticker.label}`
    : input.presentation?.kind === 'GIF' ? 'GIF'
    : input.presentation?.kind === 'STICKER_IMAGE' ? 'Sticker'
    : input.presentation?.kind === 'IMAGE' ? 'Image'
    : input.presentation?.kind === 'VIDEO' ? 'Vidéo'
    : input.presentation?.kind === 'AUDIO' ? 'Audio'
    : input.presentation?.kind === 'DOCUMENT' ? 'Document'
    : input.presentation?.kind === 'TEXT'
      ? input.presentation.text
      : input.content;
}
