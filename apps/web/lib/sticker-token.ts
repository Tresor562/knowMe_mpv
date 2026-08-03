import 'server-only';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { stickerByKey } from './sticker-catalog';

export const STICKER_MESSAGE_PREFIX = 'KNOWME_STICKER_V1';

type StickerTokenPayload = {
  schemaVersion: 1;
  packKey: string;
  packVersion: number;
  stickerKey: string;
  stickerVersion: number;
  conversationId: string;
  issuedAt: string;
  nonce: string;
};

function secret() {
  const value = process.env.STICKER_TOKEN_SECRET?.trim();
  if (!value || value.length < 32) {
    throw new Error('STICKER_TOKEN_SECRET doit contenir au moins 32 caractères.');
  }
  return value;
}

function encode(value: object) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function sign(encodedPayload: string) {
  return createHmac('sha256', secret()).update(encodedPayload).digest('base64url');
}

export function createStickerMessageToken(input: {
  packKey: string;
  stickerKey: string;
  conversationId: string;
}) {
  const resolved = stickerByKey(input.packKey, input.stickerKey);
  if (!resolved) throw new Error('Sticker indisponible.');
  const conversationId = input.conversationId.trim();
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(conversationId)) {
    throw new Error('Conversation invalide.');
  }

  const payload: StickerTokenPayload = {
    schemaVersion: 1,
    packKey: resolved.pack.key,
    packVersion: resolved.pack.version,
    stickerKey: resolved.sticker.key,
    stickerVersion: resolved.sticker.version,
    conversationId,
    issuedAt: new Date().toISOString(),
    nonce: randomUUID()
  };
  const encoded = encode(payload);
  return `${STICKER_MESSAGE_PREFIX}.${encoded}.${sign(encoded)}`;
}

export function resolveStickerMessageToken(token: string) {
  const [prefix, encoded, signature, extra] = token.trim().split('.');
  if (prefix !== STICKER_MESSAGE_PREFIX || !encoded || !signature || extra) {
    return null;
  }
  const expected = Buffer.from(sign(encoded));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }

  let payload: StickerTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as StickerTokenPayload;
  } catch {
    return null;
  }
  if (
    payload.schemaVersion !== 1 ||
    typeof payload.packKey !== 'string' ||
    typeof payload.packVersion !== 'number' ||
    typeof payload.stickerKey !== 'string' ||
    typeof payload.stickerVersion !== 'number' ||
    typeof payload.conversationId !== 'string' ||
    typeof payload.issuedAt !== 'string' ||
    typeof payload.nonce !== 'string'
  ) {
    return null;
  }

  const resolved = stickerByKey(payload.packKey, payload.stickerKey);
  if (
    !resolved ||
    resolved.pack.version !== payload.packVersion ||
    resolved.sticker.version !== payload.stickerVersion
  ) {
    return null;
  }

  return {
    payload,
    pack: {
      key: resolved.pack.key,
      version: resolved.pack.version,
      name: resolved.pack.name
    },
    sticker: resolved.sticker,
    visualOnly: true as const,
    externalAssetAllowed: false as const,
    arbitraryHtmlAllowed: false as const
  };
}
