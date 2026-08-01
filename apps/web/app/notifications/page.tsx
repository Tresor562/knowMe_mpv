'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt?: string | null;
  createdAt: string;
};

const icons: Record<string, string> = {
  FRIEND_REQUEST: '👥',
  FRIEND_ACCEPTED: '🤝',
  MESSAGE: '💬',
  POST_LIKE: '♥',
  POST_COMMENT: '💬',
  CHALLENGE_JOIN: '🎯'
};

export default function NotificationsPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      setNotifications(await apiFetch<Notification[]>('/notifications'));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Notifications indisponibles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markRead(id: string) {
    await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
    setNotifications((current) => current.map((item) =>
      item.id === id ? { ...item, readAt: new Date().toISOString() } : item
    ));
  }

  async function markAllRead() {
    await apiFetch('/notifications/read-all', { method: 'PATCH' });
    const now = new Date().toISOString();
    setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? now })));
  }

  if (sessionLoading || !user) {
    return <main className="shell"><p>Chargement...</p></main>;
  }

  const unread = notifications.filter((item) => !item.readAt).length;

  return (
    <main className="shell" style={{maxWidth:760,margin:'0 auto'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <div>
          <small style={{color:'var(--orange)'}}>ALERTES DE @{user.username}</small>
          <h1>Notifications</h1>
          <p style={{color:'var(--muted)'}}>{unread} non lue(s)</p>
        </div>
        {unread > 0 && <button className="btn" onClick={markAllRead}>Tout marquer comme lu</button>}
      </header>

      {message && <p role="alert" style={{color:'var(--orange)'}}>{message}</p>}
      {loading && <p>Chargement des notifications...</p>}

      <section className="card" style={{overflow:'hidden'}}>
        {!loading && notifications.length === 0 && (
          <div style={{padding:28,textAlign:'center'}}>
            <h2>Aucune notification</h2>
            <p style={{color:'var(--muted)'}}>Tes prochaines interactions apparaîtront ici.</p>
          </div>
        )}

        {notifications.map((notification) => (
          <button
            key={notification.id}
            onClick={() => !notification.readAt && markRead(notification.id)}
            style={{width:'100%',display:'grid',gridTemplateColumns:'48px 1fr auto',gap:14,padding:18,border:0,borderBottom:'1px solid rgba(255,255,255,.06)',alignItems:'center',textAlign:'left',background:notification.readAt ? 'transparent' : 'rgba(69,230,189,.06)',color:'inherit',cursor:'pointer'}}
          >
            <div style={{fontSize:28}}>{icons[notification.type] ?? '🔔'}</div>
            <div>
              <strong>{notification.title}</strong>
              <div style={{color:'var(--muted)',marginTop:4}}>{notification.body}</div>
            </div>
            <small style={{color:'var(--muted)'}}>{new Date(notification.createdAt).toLocaleString('fr-FR')}</small>
          </button>
        ))}
      </section>
    </main>
  );
}
