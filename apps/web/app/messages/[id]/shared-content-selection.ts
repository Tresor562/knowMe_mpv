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

/** Bulk selection replaces stale/hidden picks with the current visible tab
 * only. An explicit 50-message limit keeps native share and clipboard usable. */
export function selectVisibleMessageIds(
  conversationId: string,
  visible: readonly SharedMessage[],
  limit=50
): string[] {
  const selected:string[]=[];
  const seen=new Set<string>();
  for(const item of visible){
    if(item.conversationId!==conversationId||!item.id||seen.has(item.id))continue;
    selected.push(item.id);
    seen.add(item.id);
    if(selected.length>=Math.min(50,Math.max(1,limit)))break;
  }
  return selected;
}
