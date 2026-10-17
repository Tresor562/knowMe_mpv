/**
 * The Story feed is ordered newest-first. A rail tile represents an author,
 * not an individual Story. Preserve the first (most recent) Story for opening
 * the existing viewer and count the remaining active Stories in the same tile.
 */
export type GroupableStory = {
  id: string;
  author: { id: string } | null;
  viewer: { own: boolean };
};

export type StoryAuthorGroup<T extends GroupableStory> = {
  story: T;
  count: number;
};

export function groupStoriesByAuthor<T extends GroupableStory>(
  stories: readonly T[]
): StoryAuthorGroup<T>[] {
  const groups = new Map<string, StoryAuthorGroup<T>>();
  for (const story of stories) {
    const key = story.viewer.own ? 'owner' : story.author?.id ? `author:${story.author.id}` : null;
    if (!key) continue; // Never show a tile for an inaccessible author.
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { story, count: 1 });
  }
  return [...groups.values()];
}
