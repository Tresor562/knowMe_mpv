import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

export const MEDIA_MESSAGE_PREFIX = 'KNOWME_MEDIA_MESSAGE_V1';
export const MEDIA_MESSAGE_KINDS = ['VOICE_NOTE', 'VIDEO_NOTE'] as const;
export const VOICE_PRESETS = ['ORIGINAL', 'DEEP', 'BRIGHT', 'ROBOT'] as const;

export type MediaMessageKind = (typeof MEDIA_MESSAGE_KINDS)[number];
export type VoicePreset = (typeof VOICE_PRESETS)[number];

type MediaMessagePayload = {
  schemaVersion: 1;
  conversationId: string;
  kind: MediaMessageKind;
  assetId: string;
  mimeType: string;
  durationSeconds: number;
  voicePreset: VoicePreset | null;
  issuedAt: number;
  nonce: string;
};

export type MediaMessagePresentation = {
  kind: MediaMessageKind;
  assetId: string;
  mimeType: string;
  durationSeconds: number;
  voicePreset: VoicePreset | null;
  transformedVoice: boolean;
  mediaAccess: 'AUTHENTICATED_CONVERSATION';
};

@Injectable()
export class MediaMessageTokenService {
  constructor(private readonly config: ConfigService) {}

  create(input: {
    conversationId: string;
    kind: MediaMessageKind;
    assetId: string;
    mimeType: string;
    durationSeconds: number;
    voicePreset?: VoicePreset | null;
    now?: Date;
  }) {
    const payload: MediaMessagePayload = {
      schemaVersion: 1,
      conversationId: input.conversationId,
      kind: input.kind,
      assetId: input.assetId,
      mimeType: input.mimeType,
      durationSeconds: Number(input.durationSeconds.toFixed(3)),
      voicePreset:
        input.kind === 'VOICE_NOTE' ? input.voicePreset ?? 'ORIGINAL' : null,
      issuedAt: (input.now ?? new Date()).getTime(),
      nonce: randomUUID()
    };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = this.sign(encoded);
    return `${MEDIA_MESSAGE_PREFIX}.${encoded}.${signature}`;
  }

  resolve(
    token: string,
    input: { conversationId?: string } = {}
  ): MediaMessagePresentation | null {
    if (typeof token !== 'string' || token.length > 4096) return null;
    const [prefix, encoded, signature, extra] = token.trim().split('.');
    if (
      prefix !== MEDIA_MESSAGE_PREFIX ||
      !encoded ||
      !signature ||
      extra ||
      encoded.length > 3072 ||
      signature.length > 128
    ) {
      return null;
    }

    const expected = Buffer.from(this.sign(encoded), 'utf8');
    const received = Buffer.from(signature, 'utf8');
    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    ) {
      return null;
    }

    let payload: MediaMessagePayload;
    try {
      payload = JSON.parse(
        Buffer.from(encoded, 'base64url').toString('utf8')
      ) as MediaMessagePayload;
    } catch {
      return null;
    }
    if (!this.validPayload(payload)) return null;
    if (
      input.conversationId &&
      payload.conversationId !== input.conversationId
    ) {
      return null;
    }

    return {
      kind: payload.kind,
      assetId: payload.assetId,
      mimeType: payload.mimeType,
      durationSeconds: payload.durationSeconds,
      voicePreset: payload.voicePreset,
      transformedVoice:
        payload.kind === 'VOICE_NOTE' &&
        payload.voicePreset !== null &&
        payload.voicePreset !== 'ORIGINAL',
      mediaAccess: 'AUTHENTICATED_CONVERSATION'
    };
  }

  preview(token: string, conversationId: string) {
    const presentation = this.resolve(token, { conversationId });
    if (!presentation) return null;
    return presentation.kind === 'VIDEO_NOTE'
      ? 'Note vidéo'
      : presentation.transformedVoice
        ? 'Message vocal · voix modifiée'
        : 'Message vocal';
  }

  private sign(encoded: string) {
    return createHmac('sha256', this.signingSecret())
      .update(`${MEDIA_MESSAGE_PREFIX}.${encoded}`)
      .digest('base64url');
  }

  private signingSecret() {
    const root = this.config.get<string>('JWT_SECRET')?.trim();
    if (!root || root.length < 32) {
      throw new ServiceUnavailableException('MESSENGER_MEDIA_TOKEN_KEY_UNAVAILABLE');
    }
    return createHmac('sha256', root)
      .update('knowme:messenger-media-message:v1')
      .digest('hex');
  }

  private validPayload(value: unknown): value is MediaMessagePayload {
    if (!value || typeof value !== 'object') return false;
    const payload = value as Record<string, unknown>;
    const kind = payload.kind;
    const voicePreset = payload.voicePreset;
    return (
      payload.schemaVersion === 1 &&
      typeof payload.conversationId === 'string' &&
      /^[A-Za-z0-9_-]{8,128}$/.test(payload.conversationId) &&
      typeof kind === 'string' &&
      (MEDIA_MESSAGE_KINDS as readonly string[]).includes(kind) &&
      typeof payload.assetId === 'string' &&
      /^[A-Za-z0-9_-]{8,128}$/.test(payload.assetId) &&
      typeof payload.mimeType === 'string' &&
      payload.mimeType.length <= 100 &&
      typeof payload.durationSeconds === 'number' &&
      Number.isFinite(payload.durationSeconds) &&
      payload.durationSeconds > 0 &&
      payload.durationSeconds <= (kind === 'VIDEO_NOTE' ? 60 : 600) &&
      (kind === 'VIDEO_NOTE'
        ? voicePreset === null
        : typeof voicePreset === 'string' &&
          (VOICE_PRESETS as readonly string[]).includes(voicePreset)) &&
      typeof payload.issuedAt === 'number' &&
      Number.isFinite(payload.issuedAt) &&
      typeof payload.nonce === 'string' &&
      /^[0-9a-f-]{36}$/i.test(payload.nonce)
    );
  }
}
