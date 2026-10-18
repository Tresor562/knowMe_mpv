import type { SharedMessage } from './group-shared-content-model';

/** The client may only generate links for items actually returned by the
 * authenticated conversation endpoint and currently visible in this tab.
 * Opening a link always rechecks membership on the server. */
export function messageSelectionLinks(
  conversationId: string,
  selectedIds: readonly string[],
  visible: readonly SharedMessage[],
  origin: string,
  limit = 50
): string[] {
  if (!conversationId || !selectedIds.length) return [];
  const valid = new Set(visible.filter(item => item.conversationId===conversationId).map(item => item.id));
  const out: string[] = [], used = new Set<string>();
  for (const id of selectedIds) {
    if (!id || !valid.has(id) || used.has(id)) continue;
    used.add(id);
    out.push(new URL(`/messages/${encodeURIComponent(conversationId)}?message=${encodeURIComponent(id)}`, origin).href);
    if (out.length >= Math.min(Math.max(1, limit), 50)) break;
  }
  return out;
}


/** Selection is bounded, de-duplicated and cannot include messages from other
 * conversations even if a malformed API response mixes histories. */
export function selectVisibleMessageIds(
  conversationId: string,
  visible: readonly SharedMessage[],
  limit = 50
): string[] {
  if (!conversationId) return [];
  const ids: string[] = [], seen = new Set<string>();
  for (const item of visible) {
    if (!item || item.conversationId !== conversationId || !item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    ids.push(item.id);
    if (ids.length >= Math.min(50, Math.max(1, limit))) break;
  }
  return ids;
}
