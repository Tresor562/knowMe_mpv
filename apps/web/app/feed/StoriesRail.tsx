'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

type Story = {
  id: string;
  type: string;
  assetId?: string | null;
  thumbnailAssetId?: string | null;
  caption?: string | null;
  expiresAt?: string | null;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
  } | null;
  viewer: { own: boolean; reaction?: unknown };
};

type StoryFeedResponse = {
  stories: Story[];
  nextCursor: string | null;
};

export function StoriesRail() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch<StoryFeedResponse>('/stories/feed');
      setStories(response.stories);
    } catch (cause) {
      setStories([]);
      setError(cause instanceof Error ? cause.message : 'Stories unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section aria-label="Stories" style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <strong>Stories</strong>
        <Link href="/stories/new" className="btn">Create Story</Link>
      </div>

      {loading && (
        <div style={{ display: 'flex', gap: 12, overflowX: 'hidden' }} aria-label="Loading Stories">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} style={{ width: 72, flex: '0 0 72px' }}>
              <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'var(--surface-2)' }} />
              <div style={{ height: 8, borderRadius: 8, background: 'var(--surface-2)', marginTop: 8 }} />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="card" style={{ padding: 14 }} role="status">
          <span style={{ color: 'var(--muted)' }}>{error}</span>{' '}
          <button className="btn" onClick={() => void load()}>Retry</button>
        </div>
      )}

      {!loading && !error && (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'thin' }}>
          <Link href="/stories/new" style={{ width: 76, flex: '0 0 76px', textAlign: 'center', textDecoration: 'none', color: 'inherit' }}>
            <div style={{
              width: 68,
              height: 68,
              borderRadius: '50%',
              margin: '0 auto',
              display: 'grid',
              placeItems: 'center',
              border: '2px dashed var(--mint)',
              fontSize: 28,
              background: 'var(--surface-2)'
            }}>+</div>
            <small style={{ display: 'block', marginTop: 7 }}>Your Story</small>
          </Link>

          {stories.map((story) => (
            <Link
              href={`/stories/${story.id}`}
              key={story.id}
              style={{ width: 76, flex: '0 0 76px', textAlign: 'center', textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{
                width: 68,
                height: 68,
                margin: '0 auto',
                padding: 3,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--mint), #7957ff, #ff7a45)'
              }}>
                <div style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  background: 'var(--surface)',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800
                }}>
                  {story.author?.avatarUrl ? (
                    <img src={story.author.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    story.author?.displayName?.[0] ?? '?'
                  )}
                </div>
              </div>
              <small style={{
                display: 'block',
                marginTop: 7,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {story.viewer.own ? 'You' : story.author?.displayName ?? 'Story'}
              </small>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
