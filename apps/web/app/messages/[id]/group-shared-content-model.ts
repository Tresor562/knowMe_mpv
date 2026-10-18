/** Authorized chat-history shape exposed by /conversations/:id/messages. */
export type SharedMessage = {
  id: string;
  conversationId: string;
  content: string;
  createdAt: string;
  sender?: { id?: string; displayName?: string; username?: string; avatarUrl?: string | null };
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

/** Filtering is limited to authorized, already fetched history; it is never global
 * search and cannot reveal an asset not present in the conversation API result. */
export type SharedMediaFilter='ALL'|'IMAGE'|'VIDEO'|'GIF'|'STICKER_IMAGE'|'DOCUMENT'|'AUDIO';

export function filterSharedContent(items: SharedMessage[], kind: 'media'|'files'|'links',
  subtype: SharedMediaFilter = 'ALL'): SharedMessage[] {
  return items.filter(message =>
    contentKind(message).includes(kind) &&
    (subtype === 'ALL' || message.presentation?.kind === subtype)
  );
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


/** Author, date range, media type and chronological ordering of data already
 * returned by the authenticated conversation history endpoint. These filters
 * never ask for other users' conversations and do not imply global indexing. */
export type SharedHistorySort = 'newest' | 'oldest';
export type SharedHistoryFilter = {
  kind: SharedContentKind;
  query?: string;
  subtype?: SharedMediaFilter;
  author?: string;
  fromDate?: string;
  toDate?: string;
  sort?: SharedHistorySort;
};

export function sharedAuthorKey(message: SharedMessage): string {
  const sender = message.sender;
  if (!sender) return '';
  if (sender.id) return 'id:' + sender.id;
  if (sender.username) return 'username:' + sender.username.toLocaleLowerCase();
  if (sender.displayName) return 'name:' + sender.displayName.toLocaleLowerCase();
  return '';
}

export function sharedAuthorOptions(messages: SharedMessage[]): Array<{key:string; label:string}> {
  const authors = new Map<string,string>();
  for (const message of messages) {
    const key = sharedAuthorKey(message);
    if (!key || authors.has(key)) continue;
    authors.set(key, message.sender?.displayName || message.sender?.username || key);
  }
  return [...authors.entries()]
    .map(([key,label]) => ({key,label}))
    .sort((a,b) => a.label.localeCompare(b.label));
}

function isCalendarDate(value:string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year,month,day] = value.split('-').map(Number);
  const d = new Date(year, month-1, day);
  return d.getFullYear()===year && d.getMonth()===month-1 && d.getDate()===day;
}

export function sharedLocalDate(value:string): string {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  const pad=(value:number)=>String(value).padStart(2,'0');
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
}

export function filterSharedHistory(messages: SharedMessage[], filters: SharedHistoryFilter): SharedMessage[] {
  const base = filters.kind==='search'
    ? searchSharedMessages(messages, filters.query ?? '')
    : filterSharedContent(messages,filters.kind,filters.subtype ?? 'ALL');
  const from = filters.fromDate && isCalendarDate(filters.fromDate) ? filters.fromDate : '';
  const to = filters.toDate && isCalendarDate(filters.toDate) ? filters.toDate : '';
  const rows=base.filter(message => {
    if (filters.author && sharedAuthorKey(message) !== filters.author) return false;
    if (!from && !to) return true;
    const day=sharedLocalDate(message.createdAt);
    return Boolean(day) && (!from || day>=from) && (!to || day<=to);
  });
  return [...rows].sort((a,b)=>{
    const left=new Date(a.createdAt).getTime(), right=new Date(b.createdAt).getTime();
    const difference=(Number.isFinite(left)?left:0)-(Number.isFinite(right)?right:0);
    return filters.sort==='oldest'?difference:-difference;
  });
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
