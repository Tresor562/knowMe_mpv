import {
  assertStoryContent,
  clampCompletionBps,
  normalizeStoryHashtag,
  resolveStoryExpiry
} from './stories.domain';

describe('Stories domain', () => {
  it('keeps standard Story duration at 24 hours without Premium', () => {
    const now = new Date('2026-09-06T12:00:00.000Z');
    const expiry = resolveStoryExpiry({ hasPremiumStories: false }, now);
    expect(expiry?.toISOString()).toBe('2026-09-07T12:00:00.000Z');
  });

  it('rejects custom durations without Premium', () => {
    expect(() => resolveStoryExpiry({ durationHours: 48, hasPremiumStories: false }))
      .toThrow('STORY_PREMIUM_REQUIRED');
  });

  it('allows Premium Story durations and permanent Stories', () => {
    const now = new Date('2026-09-06T12:00:00.000Z');
    expect(resolveStoryExpiry({ durationHours: 720, hasPremiumStories: true }, now)?.toISOString())
      .toBe('2026-10-06T12:00:00.000Z');
    expect(resolveStoryExpiry({ permanent: true, hasPremiumStories: true }, now)).toBeNull();
  });

  it('requires the correct payload for typed Stories', () => {
    expect(() => assertStoryContent({ type: 'PHOTO', caption: 'caption only' }))
      .toThrow('STORY_MEDIA_REQUIRED');
    expect(() => assertStoryContent({ type: 'LINK', linkUrl: 'https://knowme.test' }))
      .not.toThrow();
    expect(() => assertStoryContent({ type: 'TEXT', caption: 'hello' }))
      .not.toThrow();
  });

  it('normalizes hashtags and completion values safely', () => {
    expect(normalizeStoryHashtag('  ##KnowMe  ')).toBe('knowme');
    expect(clampCompletionBps(-100)).toBe(0);
    expect(clampCompletionBps(10_900)).toBe(10_000);
    expect(clampCompletionBps(5_432.4)).toBe(5_432);
  });
});
