/** Authorized chat-history shape exposed by /conversations/:id/messages. */
export type SharedMessage = {
  id: string;
  conversationId: string;
  content: string;
  createdAt: string;
  sender?: { displayName?: string; username?: string; avatarUrl?: string | null };
  presentation?: {
    kind?: string;
    assetId?: string;
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
    text?: string;
  } | null;
};
export type SharedContentKind = 'media' | 'files' | 'links' | 'search';
export type SharedLink = { url: string; text: string };

/** Never render javascript:, data:, credentials or a URL with embedded controls. */
export function safeSharedLink(value: string): string | null {
  if (!value || /[\x00-\x1f\x7f\\]/.test(value)) return null;
  try {
    const uri = new URL(value);
    if (!['https:', 'http:'].includes(uri.protocol) || !uri.hostname || uri.username || uri.password) return null;
    return uri.href;
  } catch { return null; }
}

export function linksInMessage(content: string): SharedLink[] {
  const seen = new Set<string>();
  const matches = content.match(/https?:\/\/[^\s<>"'\x00-\x1f]+/gi) ?? [];
  const result: SharedLink[] = [];
  for (const token of matches.slice(0, 50)) {
    const trimmed = token.replace(/[.,;!?)}\]]+$/g, '');
    const url = safeSharedLink(trimmed);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    result.push({ url, text: trimmed });
  }
  return result;
}

export function contentKind(message: SharedMessage): SharedContentKind[] {
  const kind = message.presentation?.kind;
  const list: SharedContentKind[] = [];
  if (kind === 'IMAGE' || kind === 'VIDEO' || kind === 'GIF' || kind === 'STICKER_IMAGE') list.push('media');
  if (kind === 'DOCUMENT' || kind === 'AUDIO') list.push('files');
  const content = kind === 'TEXT' ? message.presentation?.text ?? message.content : message.content;
  if (linksInMessage(content).length) list.push('links');
  return list;
}

/** Read-only progressive search. It never claims to search pages not yet loaded. */
export function searchSharedMessages(items: SharedMessage[], query: string): SharedMessage[] {
  const fold=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
  const term=fold(query.trim()).slice(0,120);
  if(!term)return [];
  return items.filter(item=>fold([
    item.content, item.presentation?.text, item.presentation?.fileName,
    item.sender?.displayName, item.sender?.username
  ].filter(value=>typeof value==='string').join(' ')).includes(term));
}

export function appendSharedMessages(old: SharedMessage[], incoming: SharedMessage[]): SharedMessage[] {
  const existing = new Set(old.map(message => message.id));
  const fresh: SharedMessage[] = [];
  for (const item of incoming) {
    if (!item || typeof item.id !== 'string' || !item.id || existing.has(item.id)) continue;
    existing.add(item.id);
    fresh.push(item);
  }
  return [...old, ...fresh];
}
