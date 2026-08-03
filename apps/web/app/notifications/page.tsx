'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { getRealtimeSocket } from '../../lib/realtime';
import { useSession } from '../../lib/use-session';

type NotificationData = {
  route?: string;
  link?: string;
  circleId?: string;
  [key: string]: unknown;
};

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: NotificationData | null;
  readAt?: string | null;
  createdAt: string;
};

type Category =
  | 'SOCIAL'
  | 'MESSAGING'
  | 'CHALLENGES'
  | 'GIFTS'
  | 'SECRET'
  | 'CIRCLES'
  | 'SECURITY'
  | 'SYSTEM';

type Preferences = {
  masterEnabled: boolean;
  realtimeEnabled: boolean;
  pushEnabled: boolean;
  digestMode: 'INSTANT' | 'HOURLY' | 'DAILY' | 'OFF';
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
  latest: Notification;
  notificationIds: string[];
  route: string | null;
  grouped: boolean;
};

type CenterResponse = {
  preferences: Preferences;
  groups: NotificationGroup[];
  totals: {
    notifications: number;
    groups: number;
    unread: number;
    snoozed: number;
    archived: number;
  };
  policy: {
    criticalCategoriesAlwaysVisible: Category[];
    pushProviderConfigured: boolean;
    rawPushTokensStored: boolean;
    groupingWindowMinutes: number;
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
  return Math.max(0, Math.min(1439, hour * 60 + minute));
}

function actionKey(prefix: string) {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${random}`;
}

export default function NotificationsPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const socket = useMemo(() => getRealtimeSocket(), []);
  const [center, setCenter] = useState<CenterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setCenter(await apiFetch<CenterResponse>('/notifications/center'));
      setMessage('');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Notifications indisponibles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && user) void load();
  }, [load, sessionLoading, user]);

  useEffect(() => {
    if (sessionLoading || !user) return;
    const onConnect = () => setLive(true);
    const onDisconnect = () => setLive(false);
    const onCreated = () => void load();
    const onRead = (_event: ReadEvent) => void load();
    const onReadAll = (_event: ReadAllEvent) => void load();
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('notification:created', onCreated);
    socket.on('notification:read', onRead);
    socket.on('notification:read-all', onReadAll);
    if (socket.connected) onConnect();
    else socket.connect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('notification:created', onCreated);
      socket.off('notification:read', onRead);
      socket.off('notification:read-all', onReadAll);
    };
  }, [load, sessionLoading, socket, user]);

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
          pushEnabled: form.get('pushEnabled') === 'on',
          digestMode: String(form.get('digestMode')),
          quietHoursEnabled: form.get('quietHoursEnabled') === 'on',
          quietStartMinute: timeToMinute(String(form.get('quietStart'))),
          quietEndMinute: timeToMinute(String(form.get('quietEnd'))),
          timezone: String(form.get('timezone')).trim(),
          categorySettings,
          mutedTypes: center.preferences.mutedTypes,
          mutedCircleIds: center.preferences.mutedCircleIds
        })
      });
      await load();
      setMessage('Préférences de notification enregistrées.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Préférences non enregistrées.');
    } finally {
      setBusy(false);
    }
  }

  async function markGroupRead(group: NotificationGroup) {
    const unread = group.notificationIds.filter((id) => {
      if (id === group.latest.id) return !group.latest.readAt;
      return true;
    });
    await Promise.all(unread.map((id) => apiFetch(`/notifications/${id}/read`, { method: 'PATCH' })));
  }

  async function openGroup(group: NotificationGroup) {
    setBusy(true);
    try {
      await markGroupRead(group);
      const route = group.route ?? group.latest.data?.route ?? group.latest.data?.link;
      if (typeof route === 'string') window.location.href = route;
      else await load();
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
      await Promise.all(group.notificationIds.map((id) => apiFetch(`/notifications/${id}/state`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          snoozeMinutes,
          idempotencyKey: actionKey(`${action}:${id}`)
        })
      })));
      await load();
      setMessage(
        action === 'SNOOZE'
          ? 'Notification reportée.'
          : action === 'ARCHIVE'
            ? 'Notification archivée.'
            : 'Notification retirée du centre.'
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
      await load();
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
    <main className="shell" style={{ maxWidth: 920, margin: '0 auto', display: 'grid', gap: 18 }}>
      <header className="card" style={{ padding: 26 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <small style={{ color: 'var(--orange)' }}>
              CENTRE DE @{user.username} · {live ? 'EN DIRECT' : 'HORS LIGNE'}
            </small>
            <h1>Notifications intelligentes</h1>
            <p style={{ color: 'var(--muted)' }}>
              {totals?.unread ?? 0} non lue(s) · {totals?.snoozed ?? 0} reportée(s) · {totals?.archived ?? 0} archivée(s)
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" disabled={loading || busy} onClick={() => void load()}>Actualiser</button>
            <button className="btn" onClick={() => setSettingsOpen((value) => !value)}>Réglages</button>
            {(totals?.unread ?? 0) > 0 && (
              <button className="btn btn-primary" disabled={busy} onClick={() => void markAllRead()}>
                Tout marquer comme lu
              </button>
            )}
          </div>
        </div>
        {message && <p role="status" style={{ color: 'var(--mint)' }}>{message}</p>}
      </header>

      {settingsOpen && center && (
        <form className="card grid" style={{ padding: 24 }} onSubmit={savePreferences}>
          <div>
            <small style={{ color: 'var(--mint)' }}>PRÉFÉRENCES GLOBALES</small>
            <h2>Choisis comment KnowMe te prévient</h2>
            <p style={{ color: 'var(--muted)' }}>
              Les réglages spécifiques d’une guilde ou d’un Duo restent applicables. Les alertes de sécurité et système demeurent visibles dans le centre.
            </p>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
            <label className="card" style={{ padding: 14 }}><input type="checkbox" name="masterEnabled" defaultChecked={center.preferences.masterEnabled} /> Centre actif</label>
            <label className="card" style={{ padding: 14 }}><input type="checkbox" name="realtimeEnabled" defaultChecked={center.preferences.realtimeEnabled} /> Alertes en direct</label>
            <label className="card" style={{ padding: 14 }}><input type="checkbox" name="pushEnabled" defaultChecked={center.preferences.pushEnabled} /> Push mobile préparé</label>
            <label className="card" style={{ padding: 14 }}><input type="checkbox" name="quietHoursEnabled" defaultChecked={center.preferences.quietHoursEnabled} /> Heures calmes</label>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
            <label>Mode de livraison
              <select className="input" name="digestMode" defaultValue={center.preferences.digestMode}>
                <option value="INSTANT">Instantané</option>
                <option value="HOURLY">Résumé horaire</option>
                <option value="DAILY">Résumé quotidien</option>
                <option value="OFF">Centre uniquement</option>
              </select>
            </label>
            <label>Début du silence
              <input className="input" type="time" name="quietStart" defaultValue={minuteToTime(center.preferences.quietStartMinute)} />
            </label>
            <label>Fin du silence
              <input className="input" type="time" name="quietEnd" defaultValue={minuteToTime(center.preferences.quietEndMinute)} />
            </label>
            <label>Fuseau horaire
              <input className="input" name="timezone" defaultValue={center.preferences.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone} required />
            </label>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
            {CATEGORIES.map((category) => {
              const locked = category.key === 'SECURITY' || category.key === 'SYSTEM';
              return (
                <label className="card" style={{ padding: 14 }} key={category.key}>
                  <input
                    type="checkbox"
                    name={`category:${category.key}`}
                    defaultChecked={center.preferences.categorySettings[category.key]}
                    disabled={locked}
                  />{' '}
                  {category.icon} {category.label}{locked ? ' · essentiel' : ''}
                </label>
              );
            })}
          </div>
          <button className="btn btn-primary" disabled={busy}>Enregistrer mes préférences</button>
          {!center.policy.pushProviderConfigured && (
            <small style={{ color: 'var(--muted)' }}>
              Le stockage sécurisé des références d’appareil est prêt. Aucun fournisseur push externe n’est encore configuré et aucun jeton brut n’est conservé.
            </small>
          )}
        </form>
      )}

      {loading && <p>Chargement des notifications…</p>}
      {!loading && center?.groups.length === 0 && (
        <section className="card" style={{ padding: 30, textAlign: 'center' }}>
          <h2>Aucune notification visible</h2>
          <p style={{ color: 'var(--muted)' }}>Les prochaines interactions autorisées apparaîtront ici.</p>
        </section>
      )}

      <section className="grid">
        {center?.groups.map((group) => {
          const actionable = Boolean(group.route ?? group.latest.data?.route ?? group.latest.data?.link);
          return (
            <article
              className="card"
              key={group.groupKey}
              style={{ padding: 18, borderColor: group.unreadCount > 0 ? 'var(--mint)' : undefined }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '48px minmax(0,1fr) auto', gap: 14, alignItems: 'start' }}>
                <div style={{ fontSize: 28 }}>{icons[group.latest.type] ?? CATEGORIES.find((item) => item.key === group.category)?.icon ?? '🔔'}</div>
                <div>
                  <strong>{group.latest.title}</strong>
                  {group.grouped && <span style={{ marginLeft: 8, color: 'var(--mint)' }}>×{group.count}</span>}
                  <p style={{ color: 'var(--muted)', margin: '6px 0' }}>{group.latest.body}</p>
                  <small style={{ color: group.unreadCount ? 'var(--mint)' : 'var(--muted)' }}>
                    {group.unreadCount} non lue(s) · regroupement {center.policy.groupingWindowMinutes} min
                  </small>
                </div>
                <small style={{ color: 'var(--muted)', textAlign: 'right' }}>
                  {new Date(group.latest.createdAt).toLocaleString('fr-FR')}
                </small>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                {actionable && <button className="btn btn-primary" disabled={busy} onClick={() => void openGroup(group)}>Ouvrir</button>}
                {group.unreadCount > 0 && <button className="btn" disabled={busy} onClick={() => void markGroupRead(group).then(load)}>Marquer lu</button>}
                <button className="btn" disabled={busy} onClick={() => void stateGroup(group, 'SNOOZE', 60)}>Reporter 1 h</button>
                <button className="btn" disabled={busy} onClick={() => void stateGroup(group, 'ARCHIVE')}>Archiver</button>
                <button className="btn" disabled={busy} onClick={() => void stateGroup(group, 'DISMISS')}>Masquer</button>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
