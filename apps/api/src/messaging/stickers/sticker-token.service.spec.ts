import { ConfigService } from '@nestjs/config';
import { stickerCatalogInvariantErrors } from './sticker-catalog';
import { StickerTokenService } from './sticker-token.service';

const SECRET_A = 'a'.repeat(48);
const SECRET_B = 'b'.repeat(48);
const CONVERSATION_A = 'conversation_123456';
const CONVERSATION_B = 'conversation_654321';

function service(values: Record<string, unknown>) {
  return new StickerTokenService(
    new ConfigService({ NODE_ENV: 'test', ...values })
  );
}

describe('KnowMe signed stickers', () => {
  it('keeps the closed catalog internally valid', () => {
    expect(stickerCatalogInvariantErrors()).toEqual([]);
  });

  it('creates and resolves a conversation-bound token', () => {
    const tokens = service({
      STICKER_TOKEN_ACTIVE_KEY_ID: 'key-a',
      STICKER_TOKEN_ACTIVE_SECRET: SECRET_A
    });
    const now = new Date('2026-08-03T21:00:00.000Z');
    const token = tokens.create({
      conversationId: CONVERSATION_A,
      packKey: 'knowme-sparks',
      stickerKey: 'bravo',
      now
    });
    const resolved = tokens.resolve(token, {
      conversationId: CONVERSATION_A,
      now: new Date(now.getTime() + 1000)
    });

    expect(resolved?.kind).toBe('STICKER');
    expect(resolved?.sticker.key).toBe('bravo');
    expect(resolved?.externalAssetAllowed).toBe(false);
    expect(resolved?.arbitraryHtmlAllowed).toBe(false);
  });

  it('rejects a token in another conversation', () => {
    const tokens = service({
      STICKER_TOKEN_ACTIVE_SECRET: SECRET_A
    });
    const token = tokens.create({
      conversationId: CONVERSATION_A,
      packKey: 'nexus-moods',
      stickerKey: 'focus'
    });
    expect(
      tokens.resolve(token, { conversationId: CONVERSATION_B })
    ).toBeNull();
  });

  it('rejects tampering without throwing', () => {
    const tokens = service({ STICKER_TOKEN_ACTIVE_SECRET: SECRET_A });
    const token = tokens.create({
      conversationId: CONVERSATION_A,
      packKey: 'knowme-sparks',
      stickerKey: 'coeur'
    });
    const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
    expect(tokens.resolve(tampered)).toBeNull();
  });

  it('rejects an expired token', () => {
    const tokens = service({
      STICKER_TOKEN_ACTIVE_SECRET: SECRET_A,
      STICKER_TOKEN_TTL_MS: 24 * 60 * 60_000
    });
    const now = new Date('2026-08-03T21:00:00.000Z');
    const token = tokens.create({
      conversationId: CONVERSATION_A,
      packKey: 'knowme-sparks',
      stickerKey: 'merci',
      now
    });
    expect(
      tokens.resolve(token, {
        conversationId: CONVERSATION_A,
        now: new Date(now.getTime() + 24 * 60 * 60_000 + 1)
      })
    ).toBeNull();
  });

  it('resolves old messages during a controlled key rotation', () => {
    const oldTokens = service({
      STICKER_TOKEN_ACTIVE_KEY_ID: 'old',
      STICKER_TOKEN_ACTIVE_SECRET: SECRET_A
    });
    const token = oldTokens.create({
      conversationId: CONVERSATION_A,
      packKey: 'nexus-moods',
      stickerKey: 'securise'
    });
    const rotated = service({
      STICKER_TOKEN_ACTIVE_KEY_ID: 'new',
      STICKER_TOKEN_ACTIVE_SECRET: SECRET_B,
      STICKER_TOKEN_PREVIOUS_KEYS_JSON: JSON.stringify([
        { id: 'old', secret: SECRET_A }
      ])
    });

    expect(
      rotated.resolve(token, { conversationId: CONVERSATION_A })?.sticker.key
    ).toBe('securise');
  });
});
