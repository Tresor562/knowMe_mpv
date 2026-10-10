'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';
import { StoriesRail } from './StoriesRail';
import { useI18n } from '../../components/i18n-provider';

type Post = {
  id: string;
  content: string;
  imageUrl?: string | null;
  createdAt: string;
  author: { id: string; username: string; displayName: string; avatarUrl?: string | null };
  _count: { likes: number; comments: number };
};

const FEED_PAGE_SIZE = 20;

export default function FeedPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const { locale } = useI18n();
  const en = locale === 'en';
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [message, setMessage] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [authorityFresh, setAuthorityFresh] = useState(false);
  const loadGeneration = useRef(0);

  const invalidateFeedAuthority = useCallback(() => {
    loadGeneration.current += 1;
    setAuthorityFresh(false);
    setPosts([]);
    setHasMore(false);
    setLoadingMore(false);
  }, []);

  const loadFeed = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setAuthorityFresh(false);
    setPosts([]);
    setHasMore(false);
    setMessage('');

    try {
      const firstPage = await apiFetch<Post[]>('/posts/feed');
      if (generation !== loadGeneration.current) return;
      setPosts(firstPage);
      setHasMore(firstPage.length === FEED_PAGE_SIZE);
      setAuthorityFresh(true);
    } catch (cause) {
      if (generation !== loadGeneration.current) return;
      setAuthorityFresh(false);
      setPosts([]);
      setHasMore(false);
      setMessage(cause instanceof Error ? cause.message : 'Fil indisponible.');
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    invalidateFeedAuthority();
    setLoading(true);
    if (!sessionLoading && user) void loadFeed();
    return () => {
      loadGeneration.current += 1;
    };
  }, [invalidateFeedAuthority, loadFeed, sessionLoading, user?.id]);

  async function loadMore() {
    const cursor = posts.at(-1)?.id;
    if (!authorityFresh || !cursor || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const next = await apiFetch<Post[]>(`/posts/feed?cursor=${encodeURIComponent(cursor)}`);
      setPosts((current) => {
        const known = new Set(current.map((post) => post.id));
        return [...current, ...next.filter((post) => !known.has(post.id))];
      });
      setHasMore(next.length === FEED_PAGE_SIZE);
    } catch (cause) {
      invalidateFeedAuthority();
      setMessage(cause instanceof Error ? cause.message : 'Impossible de charger la suite du fil.');
    } finally {
      setLoadingMore(false);
    }
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authorityFresh) {
      setMessage(en ? 'Refresh the feed before publishing.' : 'Recharge le fil avant de publier.');
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    const content = String(data.get('content') ?? '').trim();
    if (!content) return;

    setPublishing(true);
    try {
      await apiFetch('/posts', { method: 'POST', body: JSON.stringify({ content }) });
      form.reset();
      await loadFeed();
    } catch (cause) {
      invalidateFeedAuthority();
      setMessage(cause instanceof Error ? cause.message : (en ? 'Could not publish.' : 'Publication impossible.'));
    } finally {
      setPublishing(false);
    }
  }

  async function toggleLike(postId: string) {
    if (!authorityFresh) return;
    try {
      const result = await apiFetch<{ liked: boolean }>(`/posts/${postId}/like`, { method: 'POST' });
      setPosts((current) => current.map((post) => post.id === postId
        ? { ...post, _count: { ...post._count, likes: Math.max(0, post._count.likes + (result.liked ? 1 : -1)) } }
        : post));
    } catch (cause) {
      invalidateFeedAuthority();
      setMessage(cause instanceof Error ? cause.message : 'Action impossible.');
    }
  }

  if (sessionLoading || !user) return <main className="shell"><p>Chargement du fil...</p></main>;

  return (
    <main className="shell km-feed-page">
      <header className="km-feed-header">
        <div><p className="km-profile-eyebrow">@{user.username}</p><h1>{en ? 'Feed' : 'Fil d’actualité'}</h1></div>
        <Link className="km-feed-story-cta" href="/stories/new">+ {en?'Story':'Story'}</Link>
      </header>
      <StoriesRail />
      <form id="compose" className="km-feed-composer" onSubmit={publish}>
        <textarea name="content" placeholder={en?'Share an update, an idea or a question…':'Partage une nouvelle, une idée ou une question…'} rows={2} maxLength={2000} required disabled={!authorityFresh || publishing}/>
        <div className="km-feed-compose-actions">
          <Link href="/stories/new">{en?'Create a story':'Créer une story'}</Link>
          <button className="btn btn-primary" type="submit" disabled={!authorityFresh || publishing}>
            {publishing ? (en?'Publishing…':'Publication…') : (en?'Publish':'Publier')}
          </button>
        </div>
      </form>

      {!authorityFresh && !message && <p style={{ color: 'var(--muted)' }}>{en?'Validating feed…':'Validation du fil…'}</p>}
      {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}
      {loading && <p>{en?'Loading posts…':'Chargement des publications…'}</p>}

      <section className="grid">
        {authorityFresh && !loading && posts.length === 0 && (
          <article className="km-feed-empty">
            <h2>{en?'Nothing here yet':'Le fil est encore calme'}</h2>
            <p style={{ color: 'var(--muted)' }}>{en?'Be the first to share something.':'Sois la première personne à partager quelque chose.'}</p>
          </article>
        )}

        {authorityFresh && posts.map((post) => (
          <article className="km-feed-post" key={post.id}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', fontWeight: 800 }}>
                {post.author.avatarUrl ? <img src={post.author.avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}}/> : post.author.displayName[0]}
              </div>
              <div><strong>{post.author.displayName}</strong><div style={{ color: 'var(--muted)' }}>@{post.author.username}</div></div>
            </div>
            <Link href={`/feed/${post.id}`}><p style={{ fontSize: 15, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{post.content}</p></Link>
            {post.imageUrl && <img src={post.imageUrl} alt={en?"Post media":"Média de la publication"} style={{ width: '100%', borderRadius: 18 }} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
              <button className="btn" disabled={!authorityFresh} onClick={() => void toggleLike(post.id)}>♥ {post._count.likes}</button>
              <Link className="btn" href={`/feed/${post.id}`}>💬 {post._count.comments}</Link>
              <small style={{ color: 'var(--muted)', marginLeft: 'auto' }}>{new Date(post.createdAt).toLocaleString(en?'en-US':'fr-FR')}</small>
            </div>
          </article>
        ))}
      </section>

      {authorityFresh && hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
          <button className="btn" disabled={!authorityFresh || loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? (en?'Loading…':'Chargement…') : (en?'Show more posts':'Afficher plus de publications')}
          </button>
        </div>
      )}
    </main>
  );
}
