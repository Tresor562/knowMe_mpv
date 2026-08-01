'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; displayName: string; username: string; avatarUrl?: string | null };
};

type Post = {
  id: string;
  content: string;
  imageUrl?: string | null;
  createdAt: string;
  authorId: string;
  author: { id: string; displayName: string; username: string };
  _count: { likes: number; comments: number };
};

const COMMENT_PAGE_SIZE = 30;

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const postId = params.id;
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [busyCommentId, setBusyCommentId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMessage('');
      const [postData, firstComments] = await Promise.all([
        apiFetch<Post>(`/posts/${postId}`),
        apiFetch<Comment[]>(`/posts/${postId}/comments`)
      ]);
      setPost(postData);
      setComments(firstComments);
      setHasMore(firstComments.length === COMMENT_PAGE_SIZE);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Publication introuvable.');
    }
  }, [postId]);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  async function loadMore() {
    const cursor = comments.at(-1)?.id;
    if (!cursor || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const next = await apiFetch<Comment[]>(`/posts/${postId}/comments?cursor=${encodeURIComponent(cursor)}`);
      setComments((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...next.filter((item) => !known.has(item.id))];
      });
      setHasMore(next.length === COMMENT_PAGE_SIZE);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Impossible de charger les commentaires suivants.');
    } finally {
      setLoadingMore(false);
    }
  }

  async function comment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const content = String(new FormData(form).get('content') ?? '').trim();
    if (!content) return;

    setSending(true);
    try {
      await apiFetch(`/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content })
      });
      form.reset();
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Commentaire impossible.');
    } finally {
      setSending(false);
    }
  }

  async function like() {
    try {
      await apiFetch(`/posts/${postId}/like`, { method: 'POST' });
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Action impossible.');
    }
  }

  async function removePost() {
    if (!window.confirm('Supprimer définitivement cette publication ?')) return;
    try {
      await apiFetch(`/posts/${postId}`, { method: 'DELETE' });
      window.location.href = '/feed';
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Suppression impossible.');
    }
  }

  async function removeComment(commentId: string) {
    if (!window.confirm('Supprimer ce commentaire ?')) return;
    setBusyCommentId(commentId);
    try {
      await apiFetch(`/posts/${postId}/comments/${commentId}`, { method: 'DELETE' });
      setComments((current) => current.filter((item) => item.id !== commentId));
      setPost((current) => current
        ? { ...current, _count: { ...current._count, comments: Math.max(0, current._count.comments - 1) } }
        : current
      );
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Suppression du commentaire impossible.');
    } finally {
      setBusyCommentId(null);
    }
  }

  if (sessionLoading || !post) {
    return <main className="shell"><p>{message || 'Chargement…'}</p></main>;
  }

  return (
    <main className="shell" style={{ maxWidth: 760, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div><small style={{ color: 'var(--mint)' }}>DISCUSSION</small><h1>Publication</h1></div>
        <Link href="/feed" className="btn">Retour au fil</Link>
      </header>

      {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}

      <article className="card" style={{ padding: 22 }}>
        <strong>{post.author.displayName}</strong>
        <div style={{ color: 'var(--muted)' }}>@{post.author.username}</div>
        <p style={{ fontSize: 19, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{post.content}</p>
        {post.imageUrl && <img src={post.imageUrl} alt="Média de la publication" style={{ width: '100%', borderRadius: 18 }} />}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => void like()}>♥ {post._count.likes}</button>
          <span style={{ color: 'var(--muted)' }}>💬 {post._count.comments}</span>
          {post.authorId === user?.id && (
            <button className="btn btn-accent" style={{ marginLeft: 'auto' }} onClick={() => void removePost()}>
              Supprimer la publication
            </button>
          )}
        </div>
      </article>

      <form className="card" onSubmit={comment} style={{ padding: 18, display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <input className="input" name="content" placeholder="Écris un commentaire…" maxLength={500} required style={{ flex: '1 1 320px' }} />
        <button className="btn btn-primary" disabled={sending}>{sending ? 'Envoi…' : 'Commenter'}</button>
      </form>

      <section className="grid" style={{ marginTop: 16 }} aria-label="Commentaires">
        {comments.map((item) => {
          const canDelete = item.author.id === user?.id || post.authorId === user?.id;
          return (
            <article className="card" key={item.id} style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                <div>
                  <strong>{item.author.displayName}</strong>
                  <small style={{ color: 'var(--muted)', marginLeft: 8 }}>@{item.author.username}</small>
                </div>
                {canDelete && (
                  <button
                    className="btn"
                    disabled={busyCommentId === item.id}
                    onClick={() => void removeComment(item.id)}
                  >
                    {busyCommentId === item.id ? 'Suppression…' : 'Supprimer'}
                  </button>
                )}
              </div>
              <p style={{ whiteSpace: 'pre-wrap' }}>{item.content}</p>
              <small style={{ color: 'var(--muted)' }}>{new Date(item.createdAt).toLocaleString('fr-FR')}</small>
            </article>
          );
        })}

        {!comments.length && <p style={{ color: 'var(--muted)' }}>Aucun commentaire pour le moment.</p>}
      </section>

      {hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
          <button className="btn" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? 'Chargement…' : 'Afficher plus de commentaires'}
          </button>
        </div>
      )}
    </main>
  );
}
