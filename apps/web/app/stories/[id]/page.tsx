'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type Story = {
  id: string;
  type: string;
  caption?: string | null;
  assetId?: string | null;
  linkUrl?: string | null;
  background?: Record<string, unknown> | null;
  musicAssetId?: string | null;
  locationLabel?: string | null;
  expiresAt?: string | null;
  pinnedAt?: string | null;
  allowReplies: boolean;
  allowReactions: boolean;
  allowSharing: boolean;
  hashtags: string[];
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
  } | null;
  metrics: { reactions: number; replies: number };
  viewer: { own: boolean; reaction?: { reaction: string } | null };
};

type Feed = { stories: Story[]; nextCursor: string | null };

const REACTIONS = ['❤', '😂', '🔥', '👏', '😮', '💯'];

export default function StoryViewerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [story, setStory] = useState<Story | null>(null);
  const [sequence, setSequence] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const storyId = params.id;

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const [current, feed] = await Promise.all([
        apiFetch<Story>(`/stories/${storyId}`),
        apiFetch<Feed>('/stories/feed')
      ]);
      setStory(current);
      setSequence(feed.stories);
      await apiFetch(`/stories/${storyId}/view`, {
        method: 'POST',
        body: JSON.stringify({ completionBps: 0 })
      });
    } catch (cause) {
      setStory(null);
      setSequence([]);
      setMessage(cause instanceof Error ? cause.message : 'Story unavailable.');
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  useEffect(() => {
    if (!sessionLoading && user) void load();
  }, [load, sessionLoading, user?.id]);

  const index = useMemo(() => sequence.findIndex((item) => item.id === storyId), [sequence, storyId]);
  const previousId = index > 0 ? sequence[index - 1]?.id : null;
  const nextId = index >= 0 && index < sequence.length - 1 ? sequence[index + 1]?.id : null;

  useEffect(() => {
    if (!story || loading) return;
    setProgress(0);
    const startedAt = Date.now();
    const durationMs = story.type === 'VIDEO' ? 12_000 : 7_000;
    const timer = window.setInterval(() => {
      const value = Math.min(1, (Date.now() - startedAt) / durationMs);
      setProgress(value);
      if (value >= 1) {
        window.clearInterval(timer);
        void apiFetch(`/stories/${story.id}/view`, {
          method: 'POST',
          body: JSON.stringify({ completionBps: 10_000 })
        }).catch(() => undefined);
        if (nextId) router.replace(`/stories/${nextId}`);
      }
    }, 80);
    return () => window.clearInterval(timer);
  }, [story?.id, loading, nextId, router]);

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft' && previousId) router.push(`/stories/${previousId}`);
      if (event.key === 'ArrowRight' && nextId) router.push(`/stories/${nextId}`);
      if (event.key === 'Escape') router.push('/feed');
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [nextId, previousId, router]);

  async function react(reaction: string) {
    if (!story) return;
    try {
      await apiFetch(`/stories/${story.id}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ reaction })
      });
      setStory((current) => current ? {
        ...current,
        metrics: { ...current.metrics, reactions: current.viewer.reaction ? current.metrics.reactions : current.metrics.reactions + 1 },
        viewer: { ...current.viewer, reaction: { reaction } }
      } : current);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Reaction failed.');
    }
  }

  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!story) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const content = String(data.get('content') ?? '').trim();
    if (!content) return;
    try {
      await apiFetch(`/stories/${story.id}/replies`, {
        method: 'POST',
        body: JSON.stringify({ content })
      });
      form.reset();
      setStory((current) => current ? { ...current, metrics: { ...current.metrics, replies: current.metrics.replies + 1 } } : current);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Reply failed.');
    }
  }

  async function ownerAction(action: 'archive' | 'pin' | 'unpin' | 'delete') {
    if (!story) return;
    try {
      if (action === 'delete') {
        await apiFetch(`/stories/${story.id}`, { method: 'DELETE' });
        router.replace('/feed');
        return;
      }
      if (action === 'archive') {
        await apiFetch(`/stories/${story.id}/archive`, { method: 'POST' });
        router.replace('/feed');
        return;
      }
      if (action === 'pin') await apiFetch(`/stories/${story.id}/pin`, { method: 'POST' });
      if (action === 'unpin') await apiFetch(`/stories/${story.id}/pin`, { method: 'DELETE' });
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Action failed.');
    }
  }

  if (sessionLoading || loading) return <main className="shell"><p>Loading Story…</p></main>;
  if (!story) return <main className="shell"><p role="alert">{message || 'Story unavailable.'}</p><Link href="/feed" className="btn">Back to feed</Link></main>;

  return (
    <main style={{ minHeight: '100dvh', background: '#070910', display: 'grid', placeItems: 'center', padding: 12 }}>
      <section style={{
        width: 'min(100%, 520px)',
        height: 'min(92dvh, 900px)',
        borderRadius: 28,
        overflow: 'hidden',
        position: 'relative',
        background: story.type === 'TEXT'
          ? 'linear-gradient(145deg, #6d4aff, #177f87 55%, #10131c)'
          : '#10131c',
        boxShadow: '0 32px 90px rgba(0,0,0,.55)'
      }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', zIndex: 2 }}>
          <div style={{ display: 'flex', gap: 5, padding: '12px 12px 0' }}>
            <div style={{ height: 3, borderRadius: 4, background: 'rgba(255,255,255,.28)', flex: 1, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.round(progress * 100)}%`, background: '#fff', transition: 'width 80ms linear' }} />
            </div>
          </div>

          <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, color: '#fff' }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,.14)', display: 'grid', placeItems: 'center', fontWeight: 800 }}>
              {story.author?.avatarUrl ? <img src={story.author.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : story.author?.displayName?.[0] ?? '?'}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <strong>{story.author?.displayName ?? 'KnowMe'}</strong>
              <div style={{ fontSize: 12, opacity: .75 }}>@{story.author?.username ?? 'unknown'}</div>
            </div>
            {story.locationLabel && <small style={{ opacity: .8 }}>{story.locationLabel}</small>}
            <Link href="/feed" style={{ color: '#fff', textDecoration: 'none', fontSize: 28 }} aria-label="Close Story">×</Link>
          </header>

          <div style={{ flex: 1, position: 'relative', display: 'grid', placeItems: 'center', padding: 28, color: '#fff' }}>
            {story.type === 'PHOTO' || story.type === 'VIDEO' ? (
              <div style={{ textAlign: 'center', maxWidth: 360 }}>
                <div style={{ width: 86, height: 86, borderRadius: 24, background: 'rgba(255,255,255,.10)', display: 'grid', placeItems: 'center', margin: '0 auto 16px', fontSize: 32 }}>
                  {story.type === 'PHOTO' ? '▧' : '▶'}
                </div>
                <p style={{ opacity: .8 }}>Secure media #{story.assetId?.slice(0, 8) ?? '—'}</p>
              </div>
            ) : story.type === 'LINK' ? (
              <a href={story.linkUrl ?? '#'} target="_blank" rel="noreferrer" style={{ color: '#fff', width: '100%', maxWidth: 380, padding: 22, borderRadius: 22, background: 'rgba(0,0,0,.28)', textDecoration: 'none' }}>
                <strong>Open link</strong>
                <div style={{ opacity: .8, marginTop: 8, overflowWrap: 'anywhere' }}>{story.linkUrl}</div>
              </a>
            ) : null}

            {story.caption && (
              <p style={{
                position: story.type === 'TEXT' ? 'static' : 'absolute',
                left: 24,
                right: 24,
                bottom: story.type === 'TEXT' ? undefined : 100,
                margin: 0,
                fontSize: story.type === 'TEXT' ? 30 : 18,
                lineHeight: 1.35,
                fontWeight: story.type === 'TEXT' ? 750 : 600,
                textAlign: story.type === 'TEXT' ? 'center' : 'left',
                whiteSpace: 'pre-wrap',
                textShadow: '0 2px 18px rgba(0,0,0,.7)'
              }}>{story.caption}</p>
            )}

            {story.hashtags.length > 0 && (
              <div style={{ position: 'absolute', left: 24, bottom: 70, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {story.hashtags.map((tag) => <span key={tag} style={{ padding: '5px 9px', background: 'rgba(0,0,0,.3)', borderRadius: 999, fontSize: 12 }}>#{tag}</span>)}
              </div>
            )}

            <button aria-label="Previous Story" disabled={!previousId} onClick={() => previousId && router.push(`/stories/${previousId}`)} style={{ position: 'absolute', inset: '0 50% 80px 0', opacity: 0, cursor: previousId ? 'pointer' : 'default' }} />
            <button aria-label="Next Story" disabled={!nextId} onClick={() => nextId && router.push(`/stories/${nextId}`)} style={{ position: 'absolute', inset: '0 0 80px 50%', opacity: 0, cursor: nextId ? 'pointer' : 'default' }} />
          </div>

          <footer style={{ padding: 14, color: '#fff', background: 'linear-gradient(transparent, rgba(0,0,0,.65))' }}>
            {!story.viewer.own && story.allowReactions && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto' }}>
                {REACTIONS.map((reaction) => (
                  <button key={reaction} onClick={() => void react(reaction)} style={{ border: 0, borderRadius: 999, background: story.viewer.reaction?.reaction === reaction ? 'rgba(121,87,255,.9)' : 'rgba(255,255,255,.12)', color: '#fff', padding: '8px 11px', fontSize: 18 }}>{reaction}</button>
                ))}
              </div>
            )}

            {!story.viewer.own && story.allowReplies && (
              <form onSubmit={reply} style={{ display: 'flex', gap: 8 }}>
                <input name="content" className="input" maxLength={4000} placeholder="Reply to Story…" style={{ flex: 1, background: 'rgba(255,255,255,.09)', color: '#fff' }} />
                <button className="btn btn-primary">Send</button>
              </form>
            )}

            {story.viewer.own && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <Link className="btn" href={`/stories/${story.id}/viewers`}>Views · {story.metrics.reactions} reactions · {story.metrics.replies} replies</Link>
                <button className="btn" onClick={() => void ownerAction(story.pinnedAt ? 'unpin' : 'pin')}>{story.pinnedAt ? 'Unpin' : 'Pin to profile'}</button>
                <button className="btn" onClick={() => void ownerAction('archive')}>Archive</button>
                <button className="btn" onClick={() => void ownerAction('delete')}>Delete</button>
              </div>
            )}
            {message && <small role="alert" style={{ display: 'block', color: '#ffb095', marginTop: 8 }}>{message}</small>}
          </footer>
        </div>
      </section>
    </main>
  );
}
