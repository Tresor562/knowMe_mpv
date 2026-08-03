'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { getRealtimeSocket } from '../../lib/realtime';
import { useSession } from '../../lib/use-session';

type Category =
  | 'SOCIAL'
  | 'MESSAGING'
  | 'CHALLENGES'
  | 'GIFTS'
  | 'SECRET'
  | 'CIRCLES'
  | 'SECURITY'
  | 'SYSTEM';
type View = 'ACTIVE' | 'ARCHIVED' | 'SNOOZED' | 'DISMISSED';
type DigestMode = 'INSTANT' | 'HOURLY' | 'DAILY' | 'CENTER_ONLY';

type NotificationData = {
  route?: string;
  link?: string;
  circleId?: string;
  [key: string]: unknown;
};

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: NotificationData | null;
  readAt?: string | null;
  createdAt: string;
  category: Category;
  critical: boolean;
  deliveryReason: string;
  state?: {
    dismissedAt?: string | null;
    archivedAt?: string | null;
    snoozedUntil?: string | null;
    restoredAt?: string | null;
  } | null;
};

type Preferences = {
  masterEnabled: boolean;
  realtimeEnabled: boolean;
  digestMode: DigestMode;
  dailyDigestMinute: number;
  quietHoursEnabled: boolean;
  quietStartMinute: number;
  quietEndMinute: number;
  timezone: string;
  categorySettings: Record<Category, boolean>;
  mutedTypes: string[];
  mutedCircleIds: string[];
};

type NotificationGroup = {
  groupKey: string;
  category: Category;
  count: number;
  unreadCount: number;
  latest: NotificationItem;
  notificationIds: string[];
  route: string | null;
  grouped: boolean;
};

type CenterResponse = {
  preferences: Preferences;
  view: View;
  items: NotificationItem[];
  groups: NotificationGroup[];
  nextCursor?: string | null;
  totals: {
    items: number;
    groups: number;
    unread: number;
    archived: number;
    dismissed: number;
    snoozed: number;
  };
  policy: {
    criticalCategoriesAlwaysVisible: Category[];
    transportsOwnedBy: string;
    rawTransportSecretsExposed: false;
    groupingWindowMinutes: number;
    serverTime: string;
  };
};

type ReadEvent = { notificationId: string; readAt: string };
type ReadAllEvent = { readAt: string };

const CATEGORIES: Array<{ key: Category; label: string; icon: string }> = [
  { key: 'SOCIAL', label: 'Social', icon: '👥' },
  { key: 'MESSAGING', label: 'Messages et appels', icon: '💬' },
  { key: 'CHALLENGES', label: 'Défis, jeux et quiz', icon: '🎯' },
  { key: 'GIFTS', label: 'Cadeaux et récompenses', icon: '🎁' },
  { key: 'SECRET', label: 'KnowMe Secret', icon: '🕵️' },
  { key: 'CIRCLES', label: 'Duos, équipes et guildes', icon: '⭐' },
  { key: 'SECURITY', label: 'Sécurité', icon: '🛡️' },
  { key: 'SYSTEM', label: 'Système et compte', icon: '⚙️' }
];

const VIEWS: Array<{ key: View; label: string }> = [
  { key: 'ACTIVE', label: 'Actives' },
  { key: 'SNOOZED', label: 'Reportées' },
  { key: 'ARCHIVED', label: 'Archivées' },
  { key: 'DISMISSED', label: 'Masquées' }
];

const icons: Record<string, string> = {
  FRIEND_REQUEST: '👥',
  FRIEND_ACCEPTED: '🤝',
  MESSAGE: '💬',
  POST_LIKE: '♥',
  POST_LIKED: '♥',
  POST_COMMENT: '💬',
  POST_COMMENTED: '💬',
  CHALLENGE_JOIN: '🎯',
  CHALLENGE_JOINED: '🎯',
  CIRCLE_INVITATION: '⭐',
  CIRCLE_MEMBER_JOINED: '⭐',
  CIRCLE_DAILY_DIGEST: '🗞️',
  NOTIFICATION_DIGEST: '🗞️',
  FAMILY_RELATION_PROPOSED: '👨‍👩‍👧‍👦',
  SECURITY_LOGIN_ALERT: '🛡️'
};

function minuteToTime(value: number) {
  const hour = Math.floor(value / 60).toString().padStart(2, '0');
  const minute = (value % 60).toString().padStart(2, '0');
  return `${hour}:${minute}`;
}

function timeToMinute(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return Math.max(0, Math.min(1439, hour * 60 + minute));
}

function actionKey(prefix: string) {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${random}`;
}

function mergeGroups(current: NotificationGroup[], incoming: NotificationGroup[]) {
  const byKey = new Map(current.map((group) => [group.groupKey, group]));
  for (const group of incoming) {
    const previous = byKey.get(group.groupKey);
    if (!previous) {
      byKey.set(group.groupKey, group);
      continue;
    }
    const ids = [...new Set([...previous.notificationIds, ...group.notificationIds])];
    byKey.set(group.groupKey, {
      ...group,
      count: ids.length,
      unreadCount: previous.unreadCount + group.unreadCount,
      notificationIds: ids,
      grouped: ids.length > 1,
      latest:
        new Date(previous.latest.createdAt) > new Date(group.latest.createdAt)
          ? previous.latest
          : group.latest
    });
  }
  return [...byKey.values()].sort(
    (left, right) =>
      new Date(right.latest.createdAt).getTime() -
      new Date(left.latest.createdAt).getTime()
  );
}

export default function NotificationsPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const socket = useMemo(() => getRealtimeSocket(), []);
  const [center, setCenter] = useState<CenterResponse | null>(null);
  const [view, setView] = useState<View>('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [live, setLive] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (append = false) => {
      append ? setLoadingMore(true) : setLoading(true);
      try {
        const query = new URLSearchParams({ view, limit: '30' });
        if (append && center?.nextCursor) {
          query.set('cursor', center.nextCursor);
        }
        const incoming = await apiFetch<CenterResponse>(
          `/notifications/center?${query}`
        );
        setCenter((current) =>
          append && current
            ? {
                ...incoming,
                items: [
                  ...current.items,
                  ...incoming.items.filter(
                    (item) => !current.items.some((known) => known.id === item.id)
                  )
                ],
                groups: mergeGroups(current.groups, incoming.groups)
              }
            : incoming
        );
        setMessage('');
      } catch (cause) {
        setMessage(
          cause instanceof Error
            ? cause.message
            : 'Notifications indisponibles.'
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [center?.nextCursor, view]
  );

  useEffect(() => {
    if (!sessionLoading && user) void load(false);
  }, [load, sessionLoading, user, view]);

  useEffect(() => {
    if (sessionLoading || !user) return;
    const onConnect = () => setLive(true);
    const onDisconnect = () => setLive(false);
    const reloadActive = () => {
      if (view === 'ACTIVE') void load(false);
    };
    const onRead = (_event: ReadEvent) => reloadActive();
    const onReadAll = (_event: ReadAllEvent) => reloadActive();
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('notification:created', reloadActive);
    socket.on('notification:read', onRead);
    socket.on('notification:read-all', onReadAll);
    if (socket.connected) onConnect();
    else socket.connect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('notification:created', reloadActive);
      socket.off('notification:read', onRead);
      socket.off('notification:read-all', onReadAll);
    };
  }, [load, sessionLoading, socket, user, view]);

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!center) return;
    const form = new FormData(event.currentTarget);
    const categorySettings = Object.fromEntries(
      CATEGORIES.map(({ key }) => [key, form.get(`category:${key}`) === 'on'])
    ) as Record<Category, boolean>;
    categorySettings.SECURITY = true;
    categorySettings.SYSTEM = true;
    setBusy(true);
    try {
      await apiFetch('/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          masterEnabled: form.get('masterEnabled') === 'on',
          realtimeEnabled: form.get('realtimeEnabled') === 'on',
          digestMode: String(form.get('digestMode')),
          dailyDigestMinute: timeToMinute(String(form.get('dailyDigestTime'))),
          quietHoursEnabled: form.get('quietHoursEnabled') === 'on',
          quietStartMinute: timeToMinute(String(form.get('quietStart'))),
          quietEndMinute: timeToMinute(String(form.get('quietEnd'))),
          timezone: String(form.get('timezone')).trim(),
          categorySettings,
          mutedTypes: center.preferences.mutedTypes,
          mutedCircleIds: center.preferences.mutedCircleIds
        })
      });
      await load(false);
      setMessage('Préférences de notification enregistrées.');
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : 'Préférences non enregistrées.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function markGroupRead(group: NotificationGroup) {
    await Promise.all(
      group.notificationIds.map((id) =>
        apiFetch(`/notifications/${id}/read`, { method: 'PATCH' })
      )
    );
  }

  async function openGroup(group: NotificationGroup) {
    setBusy(true);
    try {
      await markGroupRead(group);
      const route =
        group.route ?? group.latest.data?.route ?? group.latest.data?.link;
      if (typeof route === 'string') window.location.href = route;
      else await load(false);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Ouverture impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function stateGroup(
    group: NotificationGroup,
    action: 'DISMISS' | 'ARCHIVE' | 'SNOOZE' | 'RESTORE',
    snoozeMinutes?: number
  ) {
    setBusy(true);
    try {
      await Promise.all(
        group.notificationIds.map((id) =>
          apiFetch(`/notifications/${id}/state`, {
            method: 'POST',
            body: JSON.stringify({
              action,
              snoozeMinutes,
              idempotencyKey: actionKey(`${action}:${id}`)
            })
          })
        )
      );
      await load(false);
      setMessage(
        action === 'SNOOZE'
          ? 'Notification reportée.'
          : action === 'ARCHIVE'
            ? 'Notification archivée.'
            : action === 'RESTORE'
              ? 'Notification restaurée.'
              : 'Notification masquée.'
      );
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function markAllRead() {
    setBusy(true);
    try {
      await apiFetch('/notifications/read-all', { method: 'PATCH' });
      await load(false);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoading || !user) {
    return <main className="shell"><p>Chargement…</p></main>;
  }

  const totals = center?.totals;

  return (
    <main
      className="shell"
      style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gap: 18 }}
    >
      <header className="card" style={{ padding: 26 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap'
          }}
        >
          <div>
            <small style={{ color: 'var(--orange)' }}>
              CENTRE DE @{user.username} · {live ? 'EN DIRECT' : 'HORS LIGNE'}
            </small>
            <h1>Notifications intelligentes</h1>
            <p style={{ color: 'var(--muted)' }}>
              {totals?.unread ?? 0} non lue(s) · {totals?.snoozed ?? 0}{' '}
              reportée(s) · {totals?.archived ?? 0} archivée(s)
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn"
              disabled={loading || busy}
              onClick={() => void load(false)}
            >
              Actualiser
            </button>
            <button
              className="btn"
              onClick={() => setSettingsOpen((value) => !value)}
            >
              Réglages
            </button>
            {view === 'ACTIVE' && (totals?.unread ?? 0) > 0 && (
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void markAllRead()}
              >
                Tout marquer comme lu
              </button>
            )}
          </div>
        </div>
        <nav
          aria-label="Vues du centre de notifications"
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}
        >
          {VIEWS.map((candidate) => (
            <button
              type="button"
              className={`btn ${view === candidate.key ? 'btn-primary' : ''}`}
              key={candidate.key}
              onClick={() => {
                setCenter(null);
                setView(candidate.key);
              }}
            >
              {candidate.label}
            </button>
          ))}
        </nav>
        {message && (
          <p role="status" style={{ color: 'var(--mint)' }}>{message}</p>
        )}
      </header>

      {settingsOpen && center && (
        <form
          className="card grid"
          style={{ padding: 24 }}
          onSubmit={savePreferences}
        >
          <div>
            <small style={{ color: 'var(--mint)' }}>PRÉFÉRENCES GLOBALES</small>
            <h2>Choisis comment KnowMe te prévient</h2>
            <p style={{ color: 'var(--muted)' }}>
              Les alertes Sécurité et Système restent toujours visibles. Les
              endpoints externes chiffrés et leurs fournisseurs sont gérés par
              la couche de transport résiliente, jamais par ce formulaire.
            </p>
          </div>
          <div
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}
          >
            <label className="card" style={{ padding: 14 }}>
              <input
                type="checkbox"
                name="masterEnabled"
                defaultChecked={center.preferences.masterEnabled}
              />{' '}
              Centre actif
            </label>
            <label className="card" style={{ padding: 14 }}>
              <input
                type="checkbox"
                name="realtimeEnabled"
                defaultChecked={center.preferences.realtimeEnabled}
              />{' '}
              Alertes en direct
            </label>
            <label className="card" style={{ padding: 14 }}>
              <input
                type="checkbox"
                name="quietHoursEnabled"
                defaultChecked={center.preferences.quietHoursEnabled}
              />{' '}
              Heures calmes
            </label>
          </div>
          <div
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}
          >
            <label>
              Mode
              <select
                className="input"
                name="digestMode"
                defaultValue={center.preferences.digestMode}
              >
                <option value="INSTANT">Instantané</option>
                <option value="HOURLY">Résumé horaire</option>
                <option value="DAILY">Résumé quotidien</option>
                <option value="CENTER_ONLY">Centre uniquement</option>
              </select>
            </label>
            <label>
              Heure du résumé quotidien
              <input
                className="input"
                type="time"
                name="dailyDigestTime"
                defaultValue={minuteToTime(center.preferences.dailyDigestMinute)}
              />
            </label>
            <label>
              Début du silence
              <input
                className="input"
                type="time"
                name="quietStart"
                defaultValue={minuteToTime(center.preferences.quietStartMinute)}
              />
            </label>
            <label>
              Fin du silence
              <input
                className="input"
                type="time"
                name="quietEnd"
                defaultValue={minuteToTime(center.preferences.quietEndMinute)}
              />
            </label>
            <label>
              Fuseau horaire
              <input
                className="input"
                name="timezone"
                defaultValue={
                  center.preferences.timezone ||
                  Intl.DateTimeFormat().resolvedOptions().timeZone
                }
                required
              />
            </label>
          </div>
          <div
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}
          >
            {CATEGORIES.map((category) => {
              const locked =
                category.key === 'SECURITY' || category.key === 'SYSTEM';
              return (
                <label className="card" style={{ padding: 14 }} key={category.key}>
                  <input
                    type="checkbox"
                    name={`category:${category.key}`}
                    defaultChecked={
                      center.preferences.categorySettings[category.key]
                    }
                    disabled={locked}
                  />{' '}
                  {category.icon} {category.label}
                  {locked ? ' · essentiel' : ''}
                </label>
              );
            })}
          </div>
          <button className="btn btn-primary" disabled={busy}>
            Enregistrer mes préférences
          </button>
        </form>
      )}

      {loading && <p>Chargement des notifications…</p>}
      {!loading && center?.groups.length === 0 && (
        <section className="card" style={{ padding: 30, textAlign: 'center' }}>
          <h2>Aucune notification dans cette vue</h2>
          <p style={{ color: 'var(--muted)' }}>
            Les événements originaux restent conservés pour l’audit.
          </p>
        </section>
      )}

      <section style={{ display: 'grid', gap: 12 }}>
        {center?.groups.map((group) => {
          const notification = group.latest;
          const route =
            group.route ?? notification.data?.route ?? notification.data?.link;
          return (
            <article
              className="card"
              key={group.groupKey}
              style={{
                padding: 18,
                display: 'grid',
                gridTemplateColumns: '54px minmax(0,1fr)',
                gap: 14,
                borderColor: notification.critical
                  ? 'rgba(255,143,91,.55)'
                  : undefined,
                background:
                  group.unreadCount > 0
                    ? 'rgba(69,230,189,.045)'
                    : undefined
              }}
            >
              <div style={{ fontSize: 30 }}>
                {icons[notification.type] ??
                  CATEGORIES.find((item) => item.key === group.category)?.icon ??
                  '🔔'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap'
                  }}
                >
                  <div>
                    <strong>{notification.title}</strong>
                    {group.grouped && (
                      <span
                        style={{
                          marginLeft: 8,
                          padding: '3px 8px',
                          borderRadius: 999,
                          background: 'var(--surface-2)',
                          fontSize: 12
                        }}
                      >
                        {group.count} activités
                      </span>
                    )}
                    {notification.critical && (
                      <span style={{ marginLeft: 8, color: 'var(--orange)' }}>
                        Essentiel
                      </span>
                    )}
                  </div>
                  <small style={{ color: 'var(--muted)' }}>
                    {new Date(notification.createdAt).toLocaleString('fr-FR')}
                  </small>
                </div>
                <p style={{ color: 'var(--muted)', marginBottom: 10 }}>
                  {notification.body}
                </p>
                {notification.state?.snoozedUntil && (
                  <small style={{ color: 'var(--orange)' }}>
                    Reportée jusqu’au{' '}
                    {new Date(notification.state.snoozedUntil).toLocaleString(
                      'fr-FR'
                    )}
                  </small>
                )}
                <div
                  style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}
                >
                  {route && view === 'ACTIVE' && (
                    <button
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() => void openGroup(group)}
                    >
                      Ouvrir
                    </button>
                  )}
                  {group.unreadCount > 0 && view === 'ACTIVE' && (
                    <button
                      className="btn"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await markGroupRead(group);
                          await load(false);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Marquer comme lu
                    </button>
                  )}
                  {view === 'ACTIVE' && !notification.critical && (
                    <>
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() => void stateGroup(group, 'SNOOZE', 60)}
                      >
                        Reporter 1 h
                      </button>
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() => void stateGroup(group, 'ARCHIVE')}
                      >
                        Archiver
                      </button>
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() => void stateGroup(group, 'DISMISS')}
                      >
                        Masquer
                      </button>
                    </>
                  )}
                  {view !== 'ACTIVE' && (
                    <button
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() => void stateGroup(group, 'RESTORE')}
                    >
                      Restaurer
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {center?.nextCursor && (
        <button
          className="btn"
          disabled={loadingMore || busy}
          onClick={() => void load(true)}
        >
          {loadingMore ? 'Chargement…' : 'Charger plus'}
        </button>
      )}

      {center && (
        <footer className="card" style={{ padding: 16, color: 'var(--muted)' }}>
          Les secrets de transport ne sont jamais exposés. Orchestration externe :{' '}
          {center.policy.transportsOwnedBy}. Fenêtre de regroupement :{' '}
          {center.policy.groupingWindowMinutes} minutes.
        </footer>
      )}
    </main>
  );
}
