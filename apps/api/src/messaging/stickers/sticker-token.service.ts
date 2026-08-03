import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { findSticker } from './sticker-catalog';

export const STICKER_MESSAGE_PREFIX = 'KNOWME_STICKER_V1';

type StickerTokenPayload = {
  schemaVersion: 1;
  conversationId: string;
  packKey: string;
  packVersion: number;
  stickerKey: string;
  stickerVersion: number;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

type SigningKey = { id: string; secret: string };

export type StickerPresentation = {
  kind: 'STICKER';
  pack: { key: string; version: number; name: string };
  sticker: {
    key: string;
    version: number;
    label: string;
    glyph: string;
    accessibilityLabel: string;
  };
  issuedAt: string;
  expiresAt: string;
  visualOnly: true;
  externalAssetAllowed: false;
  arbitraryHtmlAllowed: false;
};

@Injectable()
export class StickerTokenService {
  constructor(private readonly config: ConfigService) {}

  create(input: {
    conversationId: string;
    packKey: string;
    stickerKey: string;
    now?: Date;
  }) {
    const resolved = findSticker(input.packKey, input.stickerKey);
    if (!resolved) throw new Error('STICKER_NOT_FOUND');
    const conversationId = input.conversationId.trim();
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(conversationId)) {
      throw new Error('STICKER_CONVERSATION_INVALID');
    }

    const now = input.now ?? new Date();
    const ttlMs = this.integer(
      'STICKER_TOKEN_TTL_MS',
      365 * 24 * 60 * 60_000,
      24 * 60 * 60_000,
      10 * 365 * 24 * 60 * 60_000
    );
    const payload: StickerTokenPayload = {
      schemaVersion: 1,
      conversationId,
      packKey: resolved.pack.key,
      packVersion: resolved.pack.version,
      stickerKey: resolved.sticker.key,
      stickerVersion: resolved.sticker.version,
      issuedAt: now.getTime(),
      expiresAt: now.getTime() + ttlMs,
      nonce: randomUUID()
    };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const key = this.activeKey();
    const signature = this.sign(key.secret, key.id, encoded);
    return `${STICKER_MESSAGE_PREFIX}.${key.id}.${encoded}.${signature}`;
  }

  resolve(
    token: string,
    input: { conversationId?: string; now?: Date } = {}
  ): StickerPresentation | null {
    if (typeof token !== 'string' || token.length > 4096) return null;
    const [prefix, keyId, encoded, signature, extra] = token.trim().split('.');
    if (
      prefix !== STICKER_MESSAGE_PREFIX ||
      !keyId ||
      !encoded ||
      !signature ||
      extra ||
      !/^[A-Za-z0-9_-]{1,40}$/.test(keyId) ||
      encoded.length > 3072 ||
      signature.length > 128
    ) {
      return null;
    }

    const key = this.keys().find((candidate) => candidate.id === keyId);
    if (!key) return null;
    const expected = Buffer.from(this.sign(key.secret, key.id, encoded), 'utf8');
    const received = Buffer.from(signature, 'utf8');
    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    ) {
      return null;
    }

    let payload: StickerTokenPayload;
    try {
      payload = JSON.parse(
        Buffer.from(encoded, 'base64url').toString('utf8')
      ) as StickerTokenPayload;
    } catch {
      return null;
    }
    if (!this.validPayload(payload)) return null;

    const now = (input.now ?? new Date()).getTime();
    if (payload.issuedAt > now + 5 * 60_000 || payload.expiresAt <= now) {
      return null;
    }
    if (
      input.conversationId &&
      payload.conversationId !== input.conversationId
    ) {
      return null;
    }

    const resolved = findSticker(payload.packKey, payload.stickerKey);
    if (
      !resolved ||
      resolved.pack.version !== payload.packVersion ||
      resolved.sticker.version !== payload.stickerVersion
    ) {
      return null;
    }

    return {
      kind: 'STICKER',
      pack: {
        key: resolved.pack.key,
        version: resolved.pack.version,
        name: resolved.pack.name
      },
      sticker: { ...resolved.sticker },
      issuedAt: new Date(payload.issuedAt).toISOString(),
      expiresAt: new Date(payload.expiresAt).toISOString(),
      visualOnly: true,
      externalAssetAllowed: false,
      arbitraryHtmlAllowed: false
    };
  }

  preview(token: string, conversationId: string) {
    const resolved = this.resolve(token, { conversationId });
    return resolved ? `Sticker : ${resolved.sticker.label}` : 'Sticker indisponible';
  }

  private activeKey(): SigningKey {
    const id =
      this.config.get<string>('STICKER_TOKEN_ACTIVE_KEY_ID')?.trim() ||
      'primary';
    const dedicated = this.config
      .get<string>('STICKER_TOKEN_ACTIVE_SECRET')
      ?.trim();
    const developmentFallback =
      this.config.get<string>('NODE_ENV') === 'production'
        ? undefined
        : this.config.get<string>('JWT_SECRET')?.trim();
    const secret = dedicated || developmentFallback;
    if (!secret || secret.length < 32) {
      throw new ServiceUnavailableException('STICKER_TOKEN_KEY_UNAVAILABLE');
    }
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) {
      throw new ServiceUnavailableException('STICKER_TOKEN_KEY_ID_INVALID');
    }
    return { id, secret };
  }

  private keys() {
    const active = this.activeKey();
    const raw = this.config
      .get<string>('STICKER_TOKEN_PREVIOUS_KEYS_JSON')
      ?.trim();
    if (!raw) return [active];

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [active];
      const previous = parsed
        .slice(0, 10)
        .flatMap((candidate): SigningKey[] => {
          if (!candidate || typeof candidate !== 'object') return [];
          const record = candidate as Record<string, unknown>;
          const id = typeof record.id === 'string' ? record.id.trim() : '';
          const secret =
            typeof record.secret === 'string' ? record.secret.trim() : '';
          return /^[A-Za-z0-9_-]{1,40}$/.test(id) && secret.length >= 32
            ? [{ id, secret }]
            : [];
        })
        .filter((candidate) => candidate.id !== active.id);
      return [active, ...previous];
    } catch {
      return [active];
    }
  }

  private sign(secret: string, keyId: string, encoded: string) {
    return createHmac('sha256', secret)
      .update(`${STICKER_MESSAGE_PREFIX}.${keyId}.${encoded}`)
      .digest('base64url');
  }

  private validPayload(value: unknown): value is StickerTokenPayload {
    if (!value || typeof value !== 'object') return false;
    const payload = value as Record<string, unknown>;
    return (
      payload.schemaVersion === 1 &&
      typeof payload.conversationId === 'string' &&
      /^[A-Za-z0-9_-]{8,128}$/.test(payload.conversationId) &&
      typeof payload.packKey === 'string' &&
      typeof payload.packVersion === 'number' &&
      Number.isInteger(payload.packVersion) &&
      typeof payload.stickerKey === 'string' &&
      typeof payload.stickerVersion === 'number' &&
      Number.isInteger(payload.stickerVersion) &&
      typeof payload.issuedAt === 'number' &&
      Number.isFinite(payload.issuedAt) &&
      typeof payload.expiresAt === 'number' &&
      Number.isFinite(payload.expiresAt) &&
      payload.expiresAt > payload.issuedAt &&
      typeof payload.nonce === 'string' &&
      /^[0-9a-f-]{36}$/i.test(payload.nonce)
    );
  }

  private integer(
    key: string,
    fallback: number,
    minimum: number,
    maximum: number
  ) {
    const raw = this.config.get<string | number>(key);
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)));
  }
}
