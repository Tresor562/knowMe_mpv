'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../../lib/api';
import { useSession } from '../../../../lib/use-session';

type Analytics = {
  uniqueViewers: number;
  totalViews: number;
  replies: number;
  reactions: number;
  averageCompletionBps: number;
  screenshots: number;
  viewers: Array<{
    viewerUserId: string;
    viewedAt: string;
    lastViewedAt: string;
    viewCount: number;
    completionBps: number;
    screenshotAt?: string | null;
    user: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl?: string | null;
    } | null;
  }>;
};

export default function StoryViewersPage() {
  const params = useParams<{ id: string }>();
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      setAnalytics(await apiFetch<Analytics>(`/stories/${params.id}/viewers`));
    } catch (cause) {
      setAnalytics(null);
      setMessage(cause instanceof Error ? cause.message : 'Story analytics unavailable.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (!sessionLoading && user) void load();
  }, [load, sessionLoading, user?.id]);

  if (sessionLoading || loading) return <main className="shell"><p>Loading Story analytics…</p></main>;

  return (
    <main className="shell" style={{ maxWidth: 760, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link className="btn" href={`/stories/${params.id}`}>←</Link>
        <div>
          <small style={{ color: 'var(--mint)' }}>STORY INSIGHTS</small>
          <h1 style={{ margin: 0 }}>Views</h1>
        </div>
      </header>

      {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}

      {analytics && (
        <>
          <section className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, margin: '18px 0' }}>
            <Metric label="Unique viewers" value={analytics.uniqueViewers} />
            <Metric label="Total views" value={analytics.totalViews} />
            <Metric label="Reactions" value={analytics.reactions} />
            <Metric label="Replies" value={analytics.replies} />
            <Metric label="Completion" value={`${(analytics.averageCompletionBps / 100).toFixed(0)}%`} />
            <Metric label="Screenshots" value={analytics.screenshots} />
          </section>

          <section className="card" style={{ padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Viewers</h2>
            {analytics.viewers.length === 0 && <p style={{ color: 'var(--muted)' }}>No views yet.</p>}
            <div className="grid" style={{ gap: 10 }}>
              {analytics.viewers.map((entry) => (
                <article key={entry.viewerUserId} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--surface-2)' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', fontWeight: 800 }}>
                    {entry.user?.avatarUrl ? <img src={entry.user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : entry.user?.displayName?.[0] ?? '?'}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong>{entry.user?.displayName ?? 'Unavailable account'}</strong>
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>{entry.user ? `@${entry.user.username}` : entry.viewerUserId}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--muted)' }}>
                    <div>{entry.viewCount}×</div>
                    <div>{Math.round(entry.completionBps / 100)}% viewed</div>
                    {entry.screenshotAt && <div>Screenshot</div>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="card" style={{ padding: 16 }}>
      <strong style={{ display: 'block', fontSize: 24 }}>{value}</strong>
      <small style={{ color: 'var(--muted)' }}>{label}</small>
    </article>
  );
}
