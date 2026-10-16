/** Selection and paging rules shared by every KnowMe native gallery entry point.
 * No uploads occur here; callers decide when to publish or send. */
export type GallerySelectable = { id: string };

export function toggleGallerySelection<T extends GallerySelectable>(
  selected: readonly T[],
  item: T,
  maxSelection: number
): { items: T[]; limitReached: boolean } {
  if (selected.some(entry => entry.id === item.id)) {
    return { items: selected.filter(entry => entry.id !== item.id), limitReached: false };
  }
  const limit = Number.isFinite(maxSelection) ? Math.max(1, Math.min(10, Math.floor(maxSelection))) : 1;
  if (selected.length >= limit) {
    return { items: [...selected], limitReached: true };
  }
  return { items: [...selected, item], limitReached: false };
}

export function mergeGalleryPage<T extends GallerySelectable>(
  current: readonly T[],
  page: readonly T[]
): T[] {
  const seen = new Set(current.map(item => item.id));
  const merged = [...current];
  for (const item of page) {
    if (!seen.has(item.id)) {
      merged.push(item);
      seen.add(item.id);
    }
  }
  return merged;
}
