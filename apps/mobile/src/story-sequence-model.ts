/** Pure story timeline rules, shared by the Android story viewer and its tests.
 * Every author has one contiguous group, oldest first. We never duplicate an
 * already fetched Story or count missing/unreadable Stories as viewed.
 */
export type SequenceStory = {
  id: string;
  createdAt?: string | null;
  author?: { id: string } | null;
};

export function storySequence<T extends SequenceStory>(
  stories: readonly T[], authorOrder: readonly string[], opened: T
): T[] {
  const unique = new Map<string, T>();
  for (const item of [...stories, opened]) if (item?.id) unique.set(item.id, item);
  const groups = new Map<string, T[]>();
  for (const item of unique.values()) {
    const author = item.author?.id ?? (item.id === opened.id ? opened.author?.id : undefined);
    if (!author) continue;
    groups.set(author, [...(groups.get(author) ?? []), item]);
  }
  const authors = [...new Set([...authorOrder, ...groups.keys()])];
  // The touched author comes first. The rest follow the visible rail order.
  const openAuthor = opened.author?.id;
  const orderedAuthors = openAuthor
    ? [openAuthor, ...authors.filter(id => id !== openAuthor)] : authors;
  return orderedAuthors.flatMap(id =>
    (groups.get(id) ?? []).sort((a,b) => {
      const t = Date.parse(a.createdAt ?? '') - Date.parse(b.createdAt ?? '');
      return (Number.isFinite(t) && t !== 0 ? t : 0) || a.id.localeCompare(b.id);
    })
  );
}

export function storySegments<T extends SequenceStory>(stories: readonly T[], active: T) {
  return stories.filter(story => story.author?.id && story.author.id === active.author?.id);
}

export function storyStep(stories: readonly SequenceStory[], id: string, direction: -1 | 1) {
  const i = stories.findIndex(story => story.id === id);
  return i < 0 ? -1 : i + direction >= 0 && i + direction < stories.length
    ? i + direction : -1;
}

export const STORY_TEXT_COLORS = [
  '#203B72', '#633BA0', '#7B344F', '#116F65',
  '#8B4932', '#34456F', '#4E347A', '#19526B'
] as const;

export function storyTextColor(background: unknown, seed: string): string {
  if (background && typeof background === 'object' && 'color' in background) {
    const color = (background as { color?: unknown }).color;
    if (typeof color === 'string' && STORY_TEXT_COLORS.includes(color as typeof STORY_TEXT_COLORS[number])) {
      return color;
    }
  }
  let hash = 0;
  for (const c of seed) hash = ((hash * 31) + c.charCodeAt(0)) >>> 0;
  return STORY_TEXT_COLORS[hash % STORY_TEXT_COLORS.length]!;
}

export function storyAgeLabel(value?: string | null, now = Date.now()): string {
  const then = Date.parse(value ?? '');
  if(!Number.isFinite(then))return 'À l’instant';
  const seconds = Math.max(0, Math.floor((now-then)/1000));
  if(seconds<60)return 'À l’instant';
  const minutes=Math.floor(seconds/60);
  if(minutes<60)return `Il y a ${minutes} min`;
  const hours=Math.floor(minutes/60);
  if(hours<24)return `Il y a ${hours} h`;
  const days=Math.floor(hours/24);
  return `Il y a ${days} j`;
}
