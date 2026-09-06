export const FREE_STORY_DURATION_HOURS = [24] as const;
export const PREMIUM_STORY_DURATION_HOURS = [1, 6, 12, 24, 48, 72, 168, 336, 720] as const;

export type StoryDurationPolicyInput = {
  durationHours?: number;
  permanent?: boolean;
  hasPremiumStories: boolean;
};

export function resolveStoryExpiry(
  input: StoryDurationPolicyInput,
  now = new Date()
): Date | null {
  if (input.permanent) {
    if (!input.hasPremiumStories) {
      throw new Error('STORY_PREMIUM_REQUIRED');
    }
    return null;
  }

  const hours = input.durationHours ?? 24;
  const allowed = input.hasPremiumStories
    ? PREMIUM_STORY_DURATION_HOURS
    : FREE_STORY_DURATION_HOURS;

  if (!allowed.includes(hours as never)) {
    throw new Error(
      input.hasPremiumStories
        ? 'STORY_DURATION_NOT_ALLOWED'
        : 'STORY_PREMIUM_REQUIRED'
    );
  }

  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

export function normalizeStoryHashtag(input: string): string {
  return input.trim().replace(/^#+/, '').toLowerCase().slice(0, 64);
}

export function assertStoryContent(input: {
  type: string;
  caption?: string;
  assetId?: string;
  giftInstanceId?: string;
  gameId?: string;
  pollId?: string;
  linkUrl?: string;
}) {
  const hasCaption = Boolean(input.caption?.trim());
  const hasAsset = Boolean(input.assetId?.trim());
  const hasSpecific = Boolean(
    input.giftInstanceId?.trim() ||
      input.gameId?.trim() ||
      input.pollId?.trim() ||
      input.linkUrl?.trim()
  );

  if (!hasCaption && !hasAsset && !hasSpecific) {
    throw new Error('STORY_CONTENT_REQUIRED');
  }

  if (input.type === 'PHOTO' || input.type === 'VIDEO') {
    if (!hasAsset) throw new Error('STORY_MEDIA_REQUIRED');
  }
  if (input.type === 'GIFT' && !input.giftInstanceId?.trim()) {
    throw new Error('STORY_GIFT_REQUIRED');
  }
  if (input.type === 'GAME' && !input.gameId?.trim()) {
    throw new Error('STORY_GAME_REQUIRED');
  }
  if (input.type === 'POLL' && !input.pollId?.trim()) {
    throw new Error('STORY_POLL_REQUIRED');
  }
  if (input.type === 'LINK' && !input.linkUrl?.trim()) {
    throw new Error('STORY_LINK_REQUIRED');
  }
}

export function clampCompletionBps(value?: number): number {
  if (value === undefined) return 0;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(10_000, Math.round(value)));
}
