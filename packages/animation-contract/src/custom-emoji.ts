/**
 * KnowMe Motion 01: six original illustrated emoji designs.
 * Stable IDs are transmitted through the existing signed sticker protocol.
 * The glyph is an accessibility and legacy-client fallback, not the artwork.
 * Artwork must be produced by KnowMe; third-party Telegram art is not bundled.
 */
export const KNOWME_MOTION_PACK_KEY = 'knowme-motion';
export const KNOWME_CUSTOM_EMOJIS = [
  { key: 'pulse-heart', glyph: '💗', label: 'Cœur pulse', motion: 'heartbeat', keywords: 'coeur amour heart love' },
  { key: 'prism-star', glyph: '🌟', label: 'Étoile prisme', motion: 'twinkle', keywords: 'étoile briller star magic' },
  { key: 'orbit-spark', glyph: '✨', label: 'Orbite magique', motion: 'wiggle', keywords: 'orbite étoiles espace magic space' },
  { key: 'galaxy-smile', glyph: '😊', label: 'Sourire galaxie', motion: 'bounce', keywords: 'sourire heureux smile happy' },
  { key: 'neon-flame', glyph: '🔥', label: 'Flamme néon', motion: 'pop', keywords: 'flamme feu fire flame' },
  { key: 'comet-rocket', glyph: '🚀', label: 'Fusée comète', motion: 'bounce', keywords: 'fusée comète rocket espace' }
] as const;

export type KnowMeCustomEmoji = typeof KNOWME_CUSTOM_EMOJIS[number];
export type KnowMeCustomEmojiKey = KnowMeCustomEmoji['key'];

export function findKnowMeCustomEmoji(packKey: string, stickerKey: string): KnowMeCustomEmoji | null {
  if (packKey !== KNOWME_MOTION_PACK_KEY) return null;
  return KNOWME_CUSTOM_EMOJIS.find(item => item.key === stickerKey) ?? null;
}
