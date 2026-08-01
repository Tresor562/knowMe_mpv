'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { getRealtimeSocket } from '../../lib/realtime';
import { useSession } from '../../lib/use-session';

type NotificationData = {
  route?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
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

type ReadEvent = { notificationId: string; readAt: string };
type ReadAllEvent = { readAt: string };

const icons: Record<string, string> = {
  FRIEND_REQUEST: '👥',
  FRIEND_ACCEPTED: '🤝',
  MESSAGE: '💬',
  POST_LIKE: '♥',
  POST_LIKED: '♥',
  POST_COMMENT: '💬',
  POST_COMMENTED: '💬',
  CHALLENGE_JOIN: '🎯',
  CHALLENGE_JOINED: '🎯'
};

export default function NotificationsPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const socket = useMemo(() => getRealtimeSocket(), []);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      setNotifications(await apiFetch<Notification[]>('/notifications'));
      setMessage('');
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : 'Notifications indisponibles.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (sessionLoading || !user) return;

    const onConnect = () => setLive(true);
    const onDisconnect = () => setLive(false);
    const onCreated = (notification: Notification) => {
      setNotifications((current) => [
        notification,
        ...current.filter((item) => item.id !== notification.id)
      ].slice(0, 50));
    };
    const onRead = (event: ReadEvent) => {
      setNotifications((current) => current.map((item) =>
        item.id === event.notificationId
          ? { ...item, readAt: event.readAt }
          : item
      ));
    };
    const onReadAll = (event: ReadAllEvent) => {
      setNotifications((current) => current.map((item) => ({
        ...item,
        readAt: item.readAt ?? event.readAt
      })));
    };

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
  }, [sessionLoading, socket, user]);

  async function markRead(notification: Notification, navigate = false) {
    try {
      if (!notification.readAt) {
        const updated = await apiFetch<Notification>(
          `/notifications/${notification.id}/read`,
          { method: 'PATCH' }
        );
        setNotifications((current) => current.map((item) =>
          item.id === notification.id ? updated : item
        ));
      }

      if (navigate && notification.data?.route) {
        window.location.href = notification.data.route;
      }
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : 'Action impossible.'
      );
    }
  }

  async function markAllRead() {
    try {
      const result = await apiFetch<{ readAt: string }>(
        '/notifications/read-all',
        { method: 'PATCH' }
      );
      setNotifications((current) => current.map((item) => ({
        ...item,
        readAt: item.readAt ?? result.readAt
      })));
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : 'Action impossible.'
      );
    }
  }

  if (sessionLoading || !user) {
    return <main className="shell"><p>Chargement...</p></main>;
  }

  const unread = notifications.filter((item) => !item.readAt).length;

  return (
    <main className="shell" style={{ maxWidth: 760, margin: '0 auto' }}>
      <header
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
            ALERTES DE @{user.username} · {live ? 'EN DIRECT' : 'HORS LIGNE'}
          </small>
          <h1>Notifications</h1>
          <p style={{ color: 'var(--muted)' }}>{unread} non lue(s)</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" disabled={loading} onClick={() => void load()}>
            Actualiser
          </button>
          {unread > 0 && (
            <button className="btn" onClick={() => void markAllRead()}>
              Tout marquer comme lu
            </button>
          )}
        </div>
      </header>

      {message && (
        <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>
      )}
      {loading && <p>Chargement des notifications...</p>}

      <section className="card" style={{ overflow: 'hidden' }}>
        {!loading && notifications.length === 0 && (
          <div style={{ padding: 28, textAlign: 'center' }}>
            <h2>Aucune notification</h2>
            <p style={{ color: 'var(--muted)' }}>
              Tes prochaines interactions apparaîtront ici en direct.
            </p>
          </div>
        )}

        {notifications.map((notification) => {
          const actionable = Boolean(notification.data?.route);
          return (
            <button
              key={notification.id}
              onClick={() => void markRead(notification, actionable)}
              style={{
                width: '100%',
                display: 'grid',
                gridTemplateColumns: '48px minmax(0,1fr) auto',
                gap: 14,
                padding: 18,
                border: 0,
                borderBottom: '1px solid rgba(255,255,255,.06)',
                alignItems: 'center',
                textAlign: 'left',
                background: notification.readAt
                  ? 'transparent'
                  : 'rgba(69,230,189,.06)',
                color: 'inherit',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontSize: 28 }}>
                {icons[notification.type] ?? '🔔'}
              </div>
              <div style={{ minWidth: 0 }}>
                <strong>{notification.title}</strong>
                <div style={{ color: 'var(--muted)', marginTop: 4 }}>
                  {notification.body}
                </div>
                {actionable && (
                  <small style={{ color: 'var(--mint)', display: 'block', marginTop: 6 }}>
                    Ouvrir l’élément concerné →
                  </small>
                )}
              </div>
              <small style={{ color: 'var(--muted)', textAlign: 'right' }}>
                {new Date(notification.createdAt).toLocaleString('fr-FR')}
              </small>
            </button>
          );
        })}
      </section>
    </main>
  );
}
