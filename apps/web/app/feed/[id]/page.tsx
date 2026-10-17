'use client';
import { knowMeConfirm } from '../../../components/knowme-feedback';

import Link from 'next/link';
import { KnowMeMentionText } from '../../../components/knowme-mention-text';
import { buildKnowMePublicLink } from '@knowme/link-contract';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useSession, type StaffBadge, type VerificationBadge } from '../../../lib/use-session';
import { AccountBadges } from '../../../components/AccountBadges';

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; displayName: string; username: string; avatarUrl?: string | null; staff?: StaffBadge | null; verification?: VerificationBadge | null };
};

type Post = {
  id: string;
  content: string;
  imageUrl?: string | null;
  createdAt: string;
  authorId: string;
  author: { id: string; displayName: string; username: string; avatarUrl?: string | null; staff?: StaffBadge | null; verification?: VerificationBadge | null };
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
  const [shareNotice, setShareNotice] = useState('');
  const [targetComment, setTargetComment] = useState('');
  const linkCursors = useState(() => new Set<string>())[0];
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

  useEffect(() => {
    setTargetComment(new URLSearchParams(window.location.search).get('comment') ?? '');
    linkCursors.clear();
  }, [postId, linkCursors]);

  useEffect(() => {
    if (!targetComment || sessionLoading || !post) return;
    const element = document.getElementById(`knowme-comment-${targetComment}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    // Seek the exact comment through paginated comments, never a substitute.
    if (!hasMore || loadingMore || !comments.length || linkCursors.size >= 100) return;
    const cursor = comments.at(-1)?.id;
    if (cursor && !linkCursors.has(cursor)) {
      linkCursors.add(cursor);
      void loadMore();
    }
  }, [targetComment, comments, hasMore, loadingMore, sessionLoading, post, linkCursors]);

  async function copyLink(kind: 'post' | 'comment', id: string) {
    const url = buildKnowMePublicLink({ kind, id });
    try {
      await navigator.clipboard.writeText(url);
      setShareNotice('Lien copié dans le presse-papiers.');
    } catch {
      setShareNotice('Copie indisponible sur cet appareil.');
    }
  }

  async function sharePost() {
    const url = buildKnowMePublicLink({ kind: 'post', id: postId });
    try {
      if (navigator.share) await navigator.share({ title: 'KnowMe', url });
      else await copyLink('post', postId);
    } catch (cause) {
      if ((cause as Error)?.name !== 'AbortError') setShareNotice('Partage indisponible sur cet appareil.');
    }
  }

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
    if (!await knowMeConfirm('Supprimer définitivement cette publication ?')) return;
    try {
      await apiFetch(`/posts/${postId}`, { method: 'DELETE' });
      window.location.href = '/feed';
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Suppression impossible.');
    }
  }

  async function removeComment(commentId: string) {
    if (!await knowMeConfirm('Supprimer ce commentaire ?')) return;
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
    <main className="shell km-post-detail">
      <header className="km-post-detail-top">
        <Link href="/feed" aria-label="Retour au fil" className="km-post-back">‹</Link>
        <h1>Publication</h1>
        <button type="button" onClick={() => void sharePost()} aria-label="Partager la publication">↗</button>
      </header>

      {message && <p role="alert" style={{ color: 'var(--orange)' }}>{message}</p>}
      {shareNotice && <p role="status" style={{ color: 'var(--mint)' }}>{shareNotice}</p>}

      <article className="km-post-detail-article">
        <header className="km-post-detail-author">
          <Link href={`/profile/${encodeURIComponent(post.author.username)}`}>
            <span className="km-post-avatar">{post.author.avatarUrl ? <img src={post.author.avatarUrl} alt="" /> : post.author.displayName.charAt(0).toUpperCase()}</span>
            <span><strong style={{display:'inline-flex',gap:5,alignItems:'center'}}>{post.author.displayName}<AccountBadges staff={post.author.staff} verification={post.author.verification} compact/></strong><small>@{post.author.username} · {new Date(post.createdAt).toLocaleDateString('fr-FR')}</small></span>
          </Link>
          <details className="km-post-options">
            <summary aria-label="Options de la publication" title="Options de la publication">⋯</summary>
            <div className="km-post-options-list">
              <button type="button" onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); void sharePost(); }}>Partager</button>
              <button type="button" onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); void copyLink('post', post.id); }}>Copier le lien</button>
              <Link href={`/profile/${encodeURIComponent(post.author.username)}`}>Voir le profil</Link>
              {post.authorId === user?.id && <button type="button" className="km-post-options-delete" onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); void removePost(); }}>Supprimer la publication</button>}
            </div>
          </details>
        </header>
        <p className="km-post-detail-text"><KnowMeMentionText text={post.content}/></p>
        {post.imageUrl && <img className="km-post-detail-image" src={post.imageUrl.startsWith('/media/public/post/') ? `/api/knowme${post.imageUrl}` : post.imageUrl} alt="Média de la publication" />}
        <div className="km-post-actions">
          <button type="button" onClick={() => void like()}>♡ <span>{post._count.likes}</span></button>
          <a href="#km-post-comments">♧ <span>{post._count.comments}</span></a>
          <button type="button" onClick={() => void sharePost()}>↗ <span>Partager</span></button>
        </div>
      </article>

      <div className="km-post-comments-heading">
        <h2>Commentaires <span>{post._count.comments}</span></h2>
      </div>

      <section id="km-post-comments" className="km-post-comments" aria-label="Commentaires">
        {comments.map((item) => {
          const canDelete = item.author.id === user?.id || post.authorId === user?.id;
          return (
            <article className="km-post-comment" key={item.id} id={`knowme-comment-${item.id}`}
              style={{ outline: targetComment === item.id ? '2px solid var(--mint)' : undefined }}>
              <div className="km-post-comment-avatar">
                {item.author.avatarUrl ? <img src={item.author.avatarUrl} alt="" /> : item.author.displayName.charAt(0)}
              </div>
              <div className="km-post-comment-content">
                <Link href={`/profile/${encodeURIComponent(item.author.username)}`}>
                  <strong style={{display:'inline-flex',gap:5,alignItems:'center'}}>{item.author.displayName}<AccountBadges staff={item.author.staff} verification={item.author.verification} compact/></strong><small>@{item.author.username}</small>
                </Link>
                <p><KnowMeMentionText text={item.content}/></p>
                <div className="km-post-comment-actions">
                  <small>{new Date(item.createdAt).toLocaleString('fr-FR')}</small>
                  <button type="button" onClick={() => void copyLink('comment', item.id)}>Lien</button>
                  {canDelete && <button type="button" disabled={busyCommentId === item.id}
                    onClick={() => void removeComment(item.id)}>
                    {busyCommentId === item.id ? 'Suppression…' : 'Supprimer'}
                  </button>}
                </div>
              </div>
            </article>
          );
        })}

        {!comments.length && <div className="km-post-comments-empty"><span aria-hidden="true">☏</span><p>Sois le premier à commenter.</p></div>}
      </section>

      {hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
          <button className="btn" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? 'Chargement…' : 'Afficher plus de commentaires'}
          </button>
        </div>
      )}
      <form className="km-post-comment-form" onSubmit={comment}>
        <label className="km-sr-only" htmlFor="km-post-comment-draft">Ton commentaire</label>
        <textarea id="km-post-comment-draft" name="content" rows={1} placeholder="Écris un commentaire…" maxLength={500} required aria-label="Commentaire" />
        <button type="submit" disabled={sending} aria-label="Envoyer le commentaire">{sending ? 'Envoi…' : 'Envoyer'}</button>
      </form>
    </main>
  );
}
