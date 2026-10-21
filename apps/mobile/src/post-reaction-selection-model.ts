/** Pure reaction input contract, independent of React Native UI and networking. */
export const FAVORITE_POST_REACTIONS = ['❤️', '😂', '😮', '😢', '😡'] as const;

/** Accept compound Unicode emoji, flags, skin tones and keycaps; reject prose. */
export function isValidPostEmojiReaction(value: string): boolean {
  const candidate = value.trim();
  const withoutKeycaps = candidate.replace(/[0-9#*]\uFE0F?\u20E3/gu, '');
  return candidate.length > 0 && candidate.length <= 32 &&
    /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{20e3}]/u.test(candidate) &&
    !/[\p{Letter}\p{Number}\p{Punctuation}]/u.test(withoutKeycaps);
}
