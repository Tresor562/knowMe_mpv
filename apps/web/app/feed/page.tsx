'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';
import { StoriesRail } from './StoriesRail';
import { useI18n } from '../../components/i18n-provider';
import { KnowMeAvatarImage } from '../../components/knowme-avatar-image';

type Post = {
  id: string;
  content: string;
  imageUrl?: string | null;
  createdAt: string;
  author: { id: string; username: string; displayName: string; avatarUrl?: string | null };
  _count: { likes: number; comments: number };
};

const FEED_PAGE_SIZE = 20;

function FeedIcon({ name }: { name: 'heart' | 'comment' | 'share' }) {
  const paths = {
    heart: <path d="M20.8 4.6a5.4 5.4 0 0 0-7.7 0L12 5.7l-1.1-1.1a5.4 5.4 0 0 0-7.7 7.7L12 21l8.8-8.7a5.4 5.4 0 0 0 0-7.7Z" />,
    comment: <path d="M20.5 11.4a8.5 8.5 0 0 1-8.5 8.5 9.5 9.5 0 0 1-3.6-.8L3 21l1.8-5.3a8.5 8.5 0 1 1 15.7-4.3Z" />,
    share: <><path d="M12 16V3m0 0L7.7 7.3M12 3l4.3 4.3" /><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></>,
  };
  return <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export default function FeedPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const { locale } = useI18n();
  const en = locale === 'en';
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [message, setMessage] = useState('');
  const [shareNotice, setShareNotice] = useState('');
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

  async function sharePost(post: Post) {
    const url = `${window.location.origin}/feed/${encodeURIComponent(post.id)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${post.author.displayName} · KnowMe`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareNotice(en ? 'Link copied.' : 'Lien copié.');
      }
    } catch (cause) {
      // Closing the share sheet is not an error in the feed.
      if ((cause as Error)?.name !== 'AbortError') {
        setShareNotice(en ? 'Sharing unavailable on this device.' : 'Partage indisponible sur cet appareil.');
      }
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
        <div className="km-feed-compose-row">
          <Link href="/profile" className="km-post-avatar" aria-label={en?'My profile':'Mon profil'}>
            <KnowMeAvatarImage src={user.avatarUrl} name={user.displayName} />
          </Link>
          <textarea name="content" placeholder={en?'What would you like to share?':'Qu’as-tu envie de partager ?'}
            rows={2} maxLength={2000} required disabled={!authorityFresh || publishing}/>
        </div>
        <div className="km-feed-compose-actions">
          <Link href="/stories/new">{en?'Add a story':'Ajouter une story'}</Link>
          <button className="btn btn-primary" type="submit" disabled={!authorityFresh || publishing}>
            {publishing ? (en?'Publishing…':'Publication…') : (en?'Publish':'Publier')}
          </button>
        </div>
      </form>

      {!authorityFresh && !message && <p style={{ color: 'var(--muted)' }}>{en?'Validating feed…':'Validation du fil…'}</p>}
      {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}
      {shareNotice && <p className="km-feed-notice" role="status" onClick={() => setShareNotice('')}>{shareNotice}</p>}
      {loading && <p>{en?'Loading posts…':'Chargement des publications…'}</p>}

      <section className="km-feed-list" aria-label={en?'Posts':'Publications'}>
        {authorityFresh && !loading && posts.length === 0 && (
          <div className="km-feed-empty">
            <h2>{en?'Nothing here yet':'Le fil est encore calme'}</h2>
            <p>{en?'Be the first to share something.':'Sois la première personne à partager quelque chose.'}</p>
          </div>
        )}

        {authorityFresh && posts.map(post => (
          <article className="km-feed-post" key={post.id}>
            <header className="km-post-header">
              <Link className="km-post-author" href={`/profile/${encodeURIComponent(post.author.username)}`}>
                <span className="km-post-avatar">
                  <KnowMeAvatarImage src={post.author.avatarUrl} name={post.author.displayName} />
                </span>
                <span className="km-post-author-copy">
                  <strong>{post.author.displayName}</strong>
                  <small>@{post.author.username} · {new Date(post.createdAt).toLocaleDateString(en?'en-US':'fr-FR')}</small>
                </span>
              </Link>
              <button type="button" className="km-post-header-share"
                onClick={() => void sharePost(post)} aria-label={en?'Share post':'Partager la publication'}>
                <FeedIcon name="share" />
              </button>
            </header>
            {post.content && <Link className="km-post-content" href={`/feed/${post.id}`}>
              <p>{post.content}</p>
            </Link>}
            {post.imageUrl && <Link className="km-post-media" href={`/feed/${post.id}`}>
              <img src={post.imageUrl} alt={en?'Post image':'Image de la publication'} loading="lazy"/>
            </Link>}
            <footer className="km-post-actions">
              <button type="button" onClick={() => void toggleLike(post.id)} disabled={!authorityFresh}
                aria-label={en?'React to post':'Réagir à la publication'}>
                <FeedIcon name="heart"/><span>{post._count.likes}</span>
              </button>
              <Link href={`/feed/${post.id}`} aria-label={en?'View comments':'Voir les commentaires'}>
                <FeedIcon name="comment"/><span>{post._count.comments}</span>
              </Link>
              <button type="button" onClick={() => void sharePost(post)}
                aria-label={en?'Share post':'Partager la publication'}>
                <FeedIcon name="share"/><span>{en?'Share':'Partager'}</span>
              </button>
            </footer>
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
