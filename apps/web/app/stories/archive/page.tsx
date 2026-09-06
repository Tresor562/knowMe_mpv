'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';
import { storyUi } from '../story-i18n';

type Story = {
  id: string;
  type: string;
  caption?: string | null;
  createdAt: string;
  archivedAt?: string | null;
  pinnedAt?: string | null;
  hashtags: string[];
};

type ArchiveResponse = { stories: Story[]; nextCursor: string | null };

export default function StoryArchivePage() {
  const ui = storyUi();
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const result = await apiFetch<ArchiveResponse>('/stories/me/archive');
      setStories(result.stories);
    } catch (cause) {
      setStories([]);
      setMessage(cause instanceof Error ? cause.message : ui.unavailable);
    } finally {
      setLoading(false);
    }
  }, [ui.unavailable]);

  useEffect(() => {
    if (!sessionLoading && user) void load();
  }, [load, sessionLoading, user?.id]);

  if (sessionLoading || loading) return <main className="shell"><p>{ui.loading}</p></main>;

  return (
    <main className="shell" style={{ maxWidth: 820, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <Link className="btn" href="/stories/new">←</Link>
        <div>
          <small style={{ color: 'var(--mint)' }}>@{user?.username}</small>
          <h1 style={{ margin: 0 }}>{ui.archive}</h1>
        </div>
      </header>

      {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}
      {!message && stories.length === 0 && <div className="card" style={{ padding: 24, textAlign: 'center' }}>{ui.noViews}</div>}

      <section className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
        {stories.map((story) => (
          <Link href={`/stories/${story.id}`} key={story.id} className="card" style={{ minHeight: 240, padding: 16, textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(145deg, rgba(121,87,255,.32), var(--surface))' }}>
            <small style={{ color: 'var(--mint)' }}>{story.type}{story.pinnedAt ? ' · PINNED' : ''}</small>
            <p style={{ fontSize: 18, whiteSpace: 'pre-wrap' }}>{story.caption || 'Story'}</p>
            <small style={{ color: 'var(--muted)' }}>{new Date(story.createdAt).toLocaleDateString()}</small>
          </Link>
        ))}
      </section>
    </main>
  );
}
