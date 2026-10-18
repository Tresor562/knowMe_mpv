export const CREATOR_CATEGORIES = [
  'TECH', 'EDUCATION', 'GAMING', 'LIFESTYLE', 'ART',
  'MUSIC', 'SPORT', 'COMMUNITY', 'OTHER'
] as const;

export type CreatorVisibility = 'PUBLIC' | 'UNLISTED';
export type CreatorStatus = 'ACTIVE' | 'PAUSED';

export type CreatorDraft = {
  slug: string;
  title: string;
  bio: string;
  category: string;
  visibility: CreatorVisibility;
  status: CreatorStatus;
};

export function normalizeCreatorSlug(input: string): string {
  return input.toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/^[^a-z0-9]+/, '')
    .slice(0, 40);
}

export function creatorDraftError(draft: CreatorDraft): 'slug' | 'title' | 'bio' | 'category' | null {
  if (!/^[a-z0-9][a-z0-9_-]{2,39}$/.test(draft.slug)) return 'slug';
  const title = draft.title.trim();
  if (title.length < 2 || title.length > 80) return 'title';
  if (draft.bio.trim().length > 300) return 'bio';
  if (!CREATOR_CATEGORIES.some(value => value === draft.category)) return 'category';
  return null;
}

/** Build the exact API DTO while preserving a creator's privacy choice. */
export function creatorUpdatePayload(draft: CreatorDraft, expectedVersion: number) {
  const error = creatorDraftError(draft);
  if (error) throw new Error(`CREATOR_DRAFT_${error.toUpperCase()}`);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw new Error('CREATOR_INVALID_VERSION');
  }
  return {
    slug: draft.slug,
    title: draft.title.trim(),
    bio: draft.bio.trim(),
    category: draft.category,
    visibility: draft.visibility,
    status: draft.status,
    expectedVersion
  };
}
