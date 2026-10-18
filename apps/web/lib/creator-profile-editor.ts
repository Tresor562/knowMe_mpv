export type CreatorVisibility = 'PUBLIC' | 'UNLISTED';
export type CreatorStatus = 'ACTIVE' | 'PAUSED';

export type CreatorForm = {
  slug: string;
  title: string;
  bio: string;
  category: string;
  visibility: CreatorVisibility;
  status: CreatorStatus;
};

export const CREATOR_CATEGORIES = [
  'TECH', 'EDUCATION', 'GAMING', 'LIFESTYLE', 'ART', 'MUSIC',
  'SPORT', 'COMMUNITY', 'OTHER'
] as const;

export function creatorFormIssue(form: CreatorForm): 'slug' | 'title' | 'bio' | 'category' | null {
  if (!/^[a-z0-9][a-z0-9_-]{2,39}$/.test(form.slug)) return 'slug';
  if (form.title.trim().length < 2 || form.title.trim().length > 80) return 'title';
  if (form.bio.trim().length > 300) return 'bio';
  if (!CREATOR_CATEGORIES.some(value => value === form.category)) return 'category';
  return null;
}

export function creatorFormPayload(form: CreatorForm, expectedVersion: number) {
  const issue = creatorFormIssue(form);
  if (issue) throw new Error(`CREATOR_INVALID_${issue.toUpperCase()}`);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0)
    throw new Error('CREATOR_INVALID_VERSION');
  return {
    slug: form.slug,
    title: form.title.trim(),
    bio: form.bio.trim(),
    category: form.category,
    visibility: form.visibility,
    status: form.status,
    expectedVersion
  };
}
