'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { apiFetch, getAccessToken } from '../lib/api';
import { getRealtimeSocket } from '../lib/realtime';
import { useI18n } from './i18n-provider';
import {
  type InAppNotification,
  type InAppPreferences,
  notificationDestination,
  notificationAlreadyVisible,
  notificationSymbol,
  shouldShowInAppNotice
} from './in-app-notification-model';
import './in-app-notifications.css';

type NotificationCenter = {
  items?: InAppNotification[];
  preferences?: InAppPreferences;
  totals?: { unread?: number };
};

type Glyph = ReturnType<typeof notificationSymbol>;
function ActivityIcon({ kind }: { kind: Glyph }) {
  const common = { viewBox:'0 0 24 24', width:21, height:21, fill:'none', stroke:'currentColor',
    strokeWidth:1.8, strokeLinecap:'round' as const, strokeLinejoin:'round' as const, 'aria-hidden':true as const };
  if (kind === 'message') return <svg {...common}><path d="M20 11.5a8.4 8.4 0 0 1-11.8 7.6L3 20.5l1.5-4.8A8.4 8.4 0 1 1 20 11.5Z"/><path d="M8 11h8M8 14.5h5"/></svg>;
  if (kind === 'mention') return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M16 8.5v6.1c0 2.9 4 .9 4-2.6M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"/></svg>;
  if (kind === 'post') return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>;
  if (kind === 'security') return <svg {...common}><path d="m12 2 8 3v6c0 5-3.2 8.3-8 11-4.8-2.7-8-6-8-11V5z"/><path d="m9 12 2 2 4-4"/></svg>;
  return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>;
}

/** Heads-up UI for the existing first-party notification center.
 * The backend decides who receives notifications; this is presentation only.
 */
export function InAppNotifications() {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { locale } = useI18n();
  const en = locale === 'en';
  const sessionToken = getAccessToken();
  const lastToken = useRef<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [navAlertsLink, setNavAlertsLink] = useState<HTMLAnchorElement | null>(null);
  const [queue, setQueue] = useState<InAppNotification[]>([]);
  const [paused, setPaused] = useState(false);
  const seenIds = useRef(new Set<string>());
  const active = queue[0];
  const insideCenter = pathname === '/notifications' || pathname.startsWith('/notifications/');
  const currentPathRef = useRef(pathname);
  currentPathRef.current = pathname;

  useEffect(() => {
    let alive = true, initialized = false, inFlight = false, repeat = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let token = sessionToken;
    if (lastToken.current !== sessionToken) {
      seenIds.current.clear();
      lastToken.current = sessionToken;
      initialized = false;
      setQueue([]);
      setUnread(0);
    }
    const refresh = async () => {
      if (inFlight) { repeat = true; return; }
      const currentToken = getAccessToken();
      if (!currentToken) {
        seenIds.current.clear(); initialized = false; token = null;
        if (alive) { setQueue([]); setUnread(0); }
        return;
      }
      if (currentToken !== token) {
        seenIds.current.clear(); initialized = false; token = currentToken;
        if (alive) { setQueue([]); setUnread(0); }
      }
      inFlight = true;
      try {
        const center = await apiFetch<NotificationCenter>('/notifications/center?view=ACTIVE&limit=30');
        if (!alive || currentToken !== getAccessToken()) return;
        setUnread(Math.max(0, Number(center?.totals?.unread ?? 0) || 0));
        const items = Array.isArray(center?.items) ? center.items : [];
        const next: InAppNotification[] = [];
        for (const item of items) {
          // Transport payloads and old API versions are external runtime data.
          if (!item || typeof item.id !== 'string' || !item.id ||
              typeof item.type !== 'string' || typeof item.category !== 'string' ||
              typeof item.title !== 'string' || typeof item.body !== 'string' ||
              seenIds.current.has(item.id)) continue;
          seenIds.current.add(item.id);
          if (initialized && currentPathRef.current !== '/notifications' &&
              !currentPathRef.current.startsWith('/notifications/') &&
              !notificationAlreadyVisible(item, currentPathRef.current) &&
              shouldShowInAppNotice(item, center.preferences ?? null, new Date())) {
            next.push(item);
          }
        }
        // First load establishes a baseline and never floods users with old alerts.
        initialized = true;
        if (seenIds.current.size > 450) {
          seenIds.current = new Set([...seenIds.current].slice(-220));
        }
        if (next.length) setQueue(existing =>
          [...existing, ...next.reverse().filter(item => !existing.some(old => old.id === item.id))].slice(0, 4));
      } catch {
        // Keep the current unread count: a network outage must not invent zero.
      } finally {
        inFlight = false;
        if (alive && repeat) { repeat = false; void refresh(); }
      }
    };
    const requestRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; void refresh(); }, 180);
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') requestRefresh(); };
    const socket = token ? getRealtimeSocket() : null;
    const activityEvents = ['notification:created', 'notification:read', 'notification:read-all', 'message:created'];
    activityEvents.forEach(name => socket?.on(name, requestRefresh));
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', requestRefresh);
    window.addEventListener('online', requestRefresh);
    window.addEventListener('storage', requestRefresh);
    const polling = setInterval(() => {
      if (document.visibilityState === 'visible') requestRefresh();
    }, 60000);
    void refresh();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      clearInterval(polling);
      activityEvents.forEach(name => socket?.off(name, requestRefresh));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', requestRefresh);
      window.removeEventListener('online', requestRefresh);
      window.removeEventListener('storage', requestRefresh);
    };
  }, [sessionToken]);

  useEffect(() => {
    if (insideCenter) setQueue([]);
  }, [insideCenter]);

  // The navigation is mounted conditionally and can move into a page header.
  // Put the small unread counter on its existing Alerts control whenever possible
  // without editing shared navigation code owned by concurrent workstreams.
  useEffect(() => {
    const sync = () => {
      const next = document.querySelector<HTMLAnchorElement>('nav.km-smart-nav a[href="/notifications"]');
      setNavAlertsLink(previous => previous === next ? previous : next);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => {
    if (!active || paused) return;
    const timer = setTimeout(() => setQueue(list => list.slice(1)), active.critical ? 9500 : 7500);
    return () => clearTimeout(timer);
  }, [active?.id, active?.critical, paused]);

  const openNotice = async (item: InAppNotification) => {
    const path = notificationDestination(item);
    setQueue(list => list.filter(known => known.id !== item.id));
    setPaused(false);
    try {
      await Promise.race([
        apiFetch('/notifications/' + encodeURIComponent(item.id) + '/read', { method:'PATCH' }),
        new Promise(resolve => setTimeout(resolve, 1000))
      ]);
    } catch { /* The destination stays available while offline. */ }
    router.push(path);
  };
  if (!getAccessToken() || insideCenter) return null;
  if (unread === 0 && !active) return null;

  return <>{unread > 0 && navAlertsLink && createPortal(
    <span className="km-live-nav-badge" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>,
    navAlertsLink
  )}
  <aside className="km-live-notification-dock" aria-label={en?'In-app notifications':'Notifications dans l’application'}>
    {active && <div className="km-live-notification-card"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false); }}
      role={active.critical ? 'alert' : 'status'} aria-live={active.critical ? 'assertive' : 'polite'}>
      <span className="km-live-notification-icon"><ActivityIcon kind={notificationSymbol(active.type, active.category)}/></span>
      <button type="button" className="km-live-notification-content"
        onClick={() => void openNotice(active)}
        aria-label={(en?'Open notification: ':'Ouvrir la notification : ') + active.title}>
        <strong>{active.title}</strong>
        <span>{active.body}</span>
      </button>
      <button type="button" className="km-live-notification-dismiss"
        onClick={() => { setQueue(list => list.slice(1)); setPaused(false); }}
        aria-label={en?'Dismiss notification':'Fermer cette notification'} title={en?'Dismiss':'Fermer'}>
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6 18 18M18 6 6 18"/></svg>
      </button>
    </div>}
    {unread > 0 && !navAlertsLink && <Link href="/notifications" className="km-live-notification-counter"
      aria-label={en ? `${unread} unread notifications` : `${unread} notifications non lues`}>
      <ActivityIcon kind="activity"/>
      <span>{unread > 99 ? '99+' : unread}</span>
    </Link>}
  </aside></>;
}
