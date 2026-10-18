export type InAppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  category: string;
  createdAt: string;
  readAt?: string | null;
  critical?: boolean;
  data?: { route?: unknown; link?: unknown } | null;
};

export type InAppPreferences = {
  masterEnabled?: boolean;
  realtimeEnabled?: boolean;
  digestMode?: string;
  quietHoursEnabled?: boolean;
  quietStartMinute?: number;
  quietEndMinute?: number;
  timezone?: string;
  categorySettings?: Record<string, boolean>;
  mutedTypes?: string[];
};

export function safeNotificationPath(value: unknown): string {
  if (typeof value !== 'string') return '/notifications';
  // No external redirects or protocol-relative URLs from event payloads.
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') ||
      /[\x00-\x1f\x7f]/.test(value)) return '/notifications';
  try {
    const url = new URL(value, 'https://knowme.invalid');
    return url.origin === 'https://knowme.invalid' ? url.pathname + url.search + url.hash : '/notifications';
  } catch {
    return '/notifications';
  }
}

export function notificationDestination(item: InAppNotification): string {
  return safeNotificationPath(item.data?.route ?? item.data?.link);
}

export function notificationAlreadyVisible(item: InAppNotification, pathname: string): boolean {
  const route = notificationDestination(item).split(/[?#]/, 1)[0];
  return route !== '/notifications' && route === pathname;
}

export function notificationSymbol(type: string, category: string): 'message' | 'mention' | 'post' | 'security' | 'activity' {
  const token = type.toUpperCase();
  if (token.includes('MESSAGE') || token.includes('CHAT') || category === 'MESSAGING') return 'message';
  if (token.includes('MENTION') || token.includes('TAG')) return 'mention';
  if (token.includes('POST') || token.includes('CREATOR') || token.includes('FOLLOW')) return 'post';
  if (category === 'SECURITY' || token.includes('SECURITY')) return 'security';
  return 'activity';
}

export function quietTimeActive(prefs: InAppPreferences, date: Date): boolean {
  if (!prefs.quietHoursEnabled) return false;
  const start = prefs.quietStartMinute ?? 0;
  const end = prefs.quietEndMinute ?? 0;
  if (![start,end].every(Number.isInteger) || start < 0 || end < 0 || start > 1439 || end > 1439 || start === end) return false;
  let hour = date.getHours(), minute = date.getMinutes();
  try {
    const formatted = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      timeZone: prefs.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    }).formatToParts(date);
    hour = Number(formatted.find(p => p.type === 'hour')?.value ?? hour);
    minute = Number(formatted.find(p => p.type === 'minute')?.value ?? minute);
  } catch { /* Invalid timezone: use the viewer's local clock. */ }
  const now = hour * 60 + minute;
  return start < end ? now >= start && now < end : now >= start || now < end;
}

export function shouldShowInAppNotice(item: InAppNotification, prefs: InAppPreferences | null, date: Date): boolean {
  if (item.readAt) return false;
  if (item.critical) return true;
  if (!prefs) return false; // Unknown server preference is not consent to interrupt.
  if (!prefs.masterEnabled || !prefs.realtimeEnabled || prefs.digestMode !== 'INSTANT') return false;
  if (prefs.mutedTypes?.includes(item.type)) return false;
  if (prefs.categorySettings?.[item.category] === false) return false;
  return !quietTimeActive(prefs, date);
}
