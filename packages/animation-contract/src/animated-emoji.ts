/**
 * KnowMe animated emoji v1.
 * Only curated Unicode emoji are animated; message payloads remain plain Unicode
 * and still work in clients that do not support motion.
 * No Telegram-owned media, external assets, or arbitrary HTML is required.
 */
export const KNOWME_ANIMATED_EMOJIS = [
  { glyph: '😀', motion: 'bounce' },
  { glyph: '😂', motion: 'bounce' },
  { glyph: '🥹', motion: 'heartbeat' },
  { glyph: '😍', motion: 'heartbeat' },
  { glyph: '🥰', motion: 'heartbeat' },
  { glyph: '❤️', motion: 'heartbeat' },
  { glyph: '💙', motion: 'heartbeat' },
  { glyph: '💜', motion: 'heartbeat' },
  { glyph: '😘', motion: 'pop' },
  { glyph: '😭', motion: 'wiggle' },
  { glyph: '🥺', motion: 'heartbeat' },
  { glyph: '😎', motion: 'pop' },
  { glyph: '🤔', motion: 'wiggle' },
  { glyph: '😱', motion: 'shake' },
  { glyph: '🤯', motion: 'shake' },
  { glyph: '🔥', motion: 'bounce' },
  { glyph: '✨', motion: 'twinkle' },
  { glyph: '🎉', motion: 'pop' },
  { glyph: '👍', motion: 'bounce' },
  { glyph: '👏', motion: 'wiggle' },
  { glyph: '🙏', motion: 'heartbeat' },
  { glyph: '👀', motion: 'wiggle' },
  { glyph: '🫶', motion: 'heartbeat' },
  { glyph: '👋', motion: 'wiggle' },
  { glyph: '🎁', motion: 'pop' },
  { glyph: '🚀', motion: 'bounce' },
  { glyph: '⭐', motion: 'twinkle' },
  { glyph: '⚡', motion: 'twinkle' }
] as const;

export type KnowMeEmojiMotion = (typeof KNOWME_ANIMATED_EMOJIS)[number]['motion'];
const motions = new Map<string, KnowMeEmojiMotion>(
  KNOWME_ANIMATED_EMOJIS.map((item) => [item.glyph, item.motion] as const)
);

export function getAnimatedEmojiMotion(glyph: string): KnowMeEmojiMotion | null {
  return motions.get(glyph) ?? null;
}

/** A single supported emoji shown as a large tappable message, not a full sentence. */
export function isStandaloneAnimatedEmojiText(value: string): boolean {
  return getAnimatedEmojiMotion(value.trim()) !== null;
}

export type EmojiTextPart = { kind: 'text' | 'emoji'; value: string };
const emojiPattern = new RegExp(
  '(' + KNOWME_ANIMATED_EMOJIS
    .map((item) => item.glyph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length)
    .join('|') + ')',
  'gu'
);

/** Safe, reversible segmentation. Never changes the stored text or its meaning. */
export function splitAnimatedEmojiText(value: string): EmojiTextPart[] {
  return value.split(emojiPattern).filter(Boolean).map((part) => ({
    kind: getAnimatedEmojiMotion(part) ? 'emoji' as const : 'text' as const,
    value: part
  }));
}
