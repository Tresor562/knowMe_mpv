'use client';
import { knowMeConfirm } from '../../../components/knowme-feedback';

import Link from 'next/link';
import { KnowMeMentionText } from '../../../components/knowme-mention-text';
import { PostMediaCollage, type PostMediaItem } from '../../../components/post-media-collage';
import { PostActionBar } from '../../../components/PostActionBar';
import { buildKnowMePublicLink } from '@knowme/link-contract';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import './comment-actions.css';
import { CommentReportSheet } from '../../../components/comment-report-sheet';
import '../../../components/comment-report-sheet.css';
import { apiFetch } from '../../../lib/api';
import { useSession, type StaffBadge, type VerificationBadge } from '../../../lib/use-session';
import { AccountBadges } from '../../../components/AccountBadges';

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  parentId?: string | null;
  _count?: { replies: number };
  author: { id: string; displayName: string; username: string; avatarUrl?: string | null; staff?: StaffBadge | null; verification?: VerificationBadge | null };
};

type Post = {
  id: string;
  content: string;
  imageUrl?: string | null;
  media?: PostMediaItem[];
  createdAt: string;
  authorId: string;
  author: { id: string; displayName: string; username: string; avatarUrl?: string | null; staff?: StaffBadge | null; verification?: VerificationBadge | null };
  _count: { likes: number; comments: number };
};

const COMMENT_PAGE_SIZE = 30;
const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '😡'];
type ReactionSummary = { total: number; mine: string | null; emojis: Array<{emoji:string;count:number}> };

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const postId = params.id;
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [post, setPost] = useState<Post | null>(null);
  const [myLike, setMyLike] = useState<boolean | null>(null);
  const likeInFlight = useRef(false);
  const likeRevision=useRef(0);
  const currentAccount=useRef<string|null>(null);
  currentAccount.current=user?.id??null;
  const [likeBusy, setLikeBusy] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [repliesByParent, setRepliesByParent] = useState<Record<string, Comment[]>>({});
  const [replyMoreByParent, setReplyMoreByParent] = useState<Record<string, boolean>>({});
  const [expandedReplies, setExpandedReplies] = useState<string[]>([]);
  const [loadingReplies, setLoadingReplies] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null);
  const [message, setMessage] = useState('');
  const [shareNotice, setShareNotice] = useState('');
  const [targetComment, setTargetComment] = useState('');
  const linkCursors = useState(() => new Set<string>())[0];
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [busyCommentId, setBusyCommentId] = useState<string | null>(null);
  const [reactionSummaries,setReactionSummaries] = useState<Record<string,ReactionSummary>>({});
  const [reactionBusy,setReactionBusy] = useState<string|null>(null);
  const [reactionPickerFor,setReactionPickerFor] = useState<string|null>(null);
  const [moreReactions,setMoreReactions] = useState(false);
  const [customEmoji,setCustomEmoji] = useState('');
  const reactionHold = useRef<number|null>(null);
  const suppressReactionClick = useRef(false);
  const [contextCommentId, setContextCommentId] = useState<string | null>(null);
  const [reportingComment, setReportingComment] = useState<Comment | null>(null);
  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [editFeedback, setEditFeedback] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const saveInFlight = useRef(false);
  const holdTimer = useRef<number | null>(null);
  const allLoadedComments = [
    ...comments,
    ...Object.values(repliesByParent).flat()
  ];
  const selectedComment = allLoadedComments.find(entry => entry.id === contextCommentId) ?? null;
  const visibleCommentIds = [...new Set(allLoadedComments.map(item=>item.id))].join(',');

  useEffect(() => {
    if (!visibleCommentIds || !user) return;
    let active = true;
    const ids = visibleCommentIds.split(',');
    void Promise.all(Array.from({length:Math.ceil(ids.length/30)},(_,index)=>{
      const batch = ids.slice(index*30,index*30+30);
      return apiFetch<Record<string,ReactionSummary>>(
        `/posts/${encodeURIComponent(postId)}/comments/reaction-summaries?ids=${encodeURIComponent(batch.join(','))}`
      );
    })).then(parts=>{
      if(active) setReactionSummaries(old=>Object.assign({},old,...parts));
    }).catch(()=>undefined);
    return ()=>{active=false;};
  },[postId,visibleCommentIds,user?.id]);

  async function reactToComment(id:string,emoji:string) {
    if(reactionBusy) return;
    const current = reactionSummaries[id];
    setReactionBusy(id);
    try {
      const endpoint = `/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(id)}/reaction`;
      const result = current?.mine === emoji
        ? await apiFetch<ReactionSummary>(endpoint,{method:'DELETE'})
        : await apiFetch<ReactionSummary>(endpoint,{method:'PUT',body:JSON.stringify({emoji})});
      setReactionSummaries(old=>({...old,[id]:result}));
      setReactionPickerFor(null);
      setMoreReactions(false);
      setCustomEmoji('');
    }catch(cause){
      setMessage(cause instanceof Error ? cause.message : 'Réaction indisponible.');
    }finally{setReactionBusy(null);}
  }

  function openReactionPicker(id:string) {
    setReactionPickerFor(id);
    setMoreReactions(false);
  }

  function cancelReactionHold(){
    if(reactionHold.current !== null) window.clearTimeout(reactionHold.current);
    reactionHold.current = null;
  }


  const clearHold = useCallback(() => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  }, []);

  useEffect(() => {
    if (!contextCommentId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContextCommentId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [contextCommentId]);

  useEffect(() => () => { clearHold(); cancelReactionHold(); }, [clearHold]);

  async function submitCommentEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingComment || editingComment.author.id !== user?.id || saveInFlight.current) return;
    const content = editDraft.trim();
    if (!content || content.length > 500) {
      setEditFeedback('Le commentaire doit contenir entre 1 et 500 caractères.');
      return;
    }
    saveInFlight.current = true;
    setSavingEdit(true);
    setEditFeedback('');
    try {
      const updated = await apiFetch<Comment>(
        `/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(editingComment.id)}`,
        { method: 'PATCH', body: JSON.stringify({ content }) }
      );
      setComments(current => current.map(item =>
        item.id === editingComment.id ? { ...item, content: updated.content } : item
      ));
      setRepliesByParent(current => Object.fromEntries(Object.entries(current).map(([id, entries]) =>
        [id, entries.map(item => item.id === editingComment.id
          ? { ...item, content: updated.content } : item)]
      )));
      setEditingComment(null);
      setShareNotice('Commentaire modifié.');
    } catch (cause) {
      const error = cause as { code?: string; message?: string };
      const uncertain = error?.code === 'KNOWME_TIMEOUT' || error?.code === 'KNOWME_NETWORK_UNAVAILABLE';
      setEditFeedback(uncertain
        ? 'Modification non confirmée. Vérifie le commentaire avant de réessayer.'
        : cause instanceof Error ? cause.message : 'Modification impossible.');
    } finally {
      saveInFlight.current = false;
      setSavingEdit(false);
    }
  }

  async function copyCommentText(item: Comment) {
    try {
      await navigator.clipboard.writeText(item.content);
      setShareNotice('Texte du commentaire copié.');
      setContextCommentId(null);
    } catch {
      setMessage('Impossible de copier le texte sur cet appareil.');
    }
  }

  const load = useCallback(async () => {
    try {
      setMessage('');
      const [postData, firstComments] = await Promise.all([
        apiFetch<Post>(`/posts/${postId}`),
        apiFetch<Comment[]>(`/posts/${postId}/comments?roots=true`)
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
      const next = await apiFetch<Comment[]>(`/posts/${postId}/comments?roots=true&cursor=${encodeURIComponent(cursor)}`);
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

  async function showReplies(item: Comment, append = false) {
    if (loadingReplies) return;
    if (!append && expandedReplies.includes(item.id)) {
      setExpandedReplies(current => current.filter(id => id !== item.id));
      return;
    }
    setLoadingReplies(item.id);
    try {
      const current = repliesByParent[item.id] ?? [];
      const cursor = append ? current.at(-1)?.id : undefined;
      const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
      const response = await apiFetch<Comment[]>(
        `/posts/${postId}/comments/${encodeURIComponent(item.id)}/replies${query}`
      );
      setRepliesByParent(previous => {
        const existing = append ? previous[item.id] ?? [] : [];
        const seen = new Set(existing.map(reply => reply.id));
        return { ...previous, [item.id]: [
          ...existing,
          ...response.filter(reply => !seen.has(reply.id))
        ]};
      });
      setReplyMoreByParent(prev => ({ ...prev, [item.id]: response.length === COMMENT_PAGE_SIZE }));
      setExpandedReplies(prev => prev.includes(item.id) ? prev : [...prev, item.id]);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Impossible de charger les réponses.');
    } finally {
      setLoadingReplies(null);
    }
  }

  function beginReply(item: Comment) {
    setReplyTarget(item);
    setContextCommentId(null);
    window.requestAnimationFrame(() => {
      document.getElementById('km-post-comment-draft')?.focus();
    });
  }

  async function comment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const content = String(new FormData(form).get('content') ?? '').trim();
    if (!content || sending) return;

    const replyingTo = replyTarget;
    setSending(true);
    try {
      await apiFetch(`/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          content, ...(replyingTo ? { parentId: replyingTo.id } : {})
        })
      });
    } catch (cause) {
      // An uncertain POST may have committed on the server. Do not silently
      // retry it or tell the user with certainty that their reply was lost.
      const error = cause as { code?: string; message?: string };
      const uncertain = error?.code === 'KNOWME_TIMEOUT' ||
        error?.code === 'KNOWME_NETWORK_UNAVAILABLE';
      setMessage(uncertain
        ? 'Envoi non confirmé. Vérifie les commentaires avant de réessayer pour éviter un doublon.'
        : cause instanceof Error ? cause.message : 'Commentaire impossible.');
      setSending(false);
      return;
    }

    // The POST is successful. A failed subsequent GET is a refresh problem,
    // not a failed publication; preserve this distinction in user feedback.
    form.reset();
    setReplyTarget(null);
    setShareNotice(replyingTo ? 'Réponse publiée.' : 'Commentaire publié.');
    try {
      await load();
      if (replyingTo) {
        const replies = await apiFetch<Comment[]>(
          `/posts/${postId}/comments/${encodeURIComponent(replyingTo.id)}/replies`
        );
        setRepliesByParent(prev => ({ ...prev, [replyingTo.id]: replies }));
        setReplyMoreByParent(prev => ({
          ...prev, [replyingTo.id]: replies.length === COMMENT_PAGE_SIZE
        }));
        setExpandedReplies(prev => prev.includes(replyingTo.id)
          ? prev : [...prev, replyingTo.id]);
      }
    } catch {
      setMessage('Commentaire publié, mais actualisation impossible. Réessaie de charger les réponses.');
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    let active = true;
    const revision=likeRevision.current;
    setMyLike(null);
    if (!user?.id || !postId) return () => {active = false;};
    void apiFetch<Record<string,boolean>>(`/post-like-status?ids=${encodeURIComponent(postId)}`)
      .then(result => {if(active && revision===likeRevision.current) setMyLike(result[postId] === true);})
      .catch(()=>{/* Keep selection unknown when the status could not be loaded. */});
    return () => {active = false;};
  },[postId,user?.id]);

  async function like() {
    if(likeInFlight.current || !user?.id) return;
    likeInFlight.current = true;
    likeRevision.current+=1;
    setLikeBusy(true);
    const actor = user.id;
    try {
      const result = await apiFetch<{liked:boolean}>(`/posts/${encodeURIComponent(postId)}/like`,{method:'POST'});
      if(actor!==currentAccount.current) return;
      setMyLike(result.liked);
      setPost(current=>current ? {...current,
        _count:{...current._count,likes:Math.max(0,current._count.likes+(result.liked?1:-1))}
      }:current);
    }catch(cause){
      setMessage(cause instanceof Error?cause.message:'Action non confirmée.');
    }finally{
      likeInFlight.current = false;
      setLikeBusy(false);
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
      setComments(current => current.filter(item => item.id !== commentId));
      setRepliesByParent(current => Object.fromEntries(
        Object.entries(current)
          .filter(([id]) => id !== commentId)
          .map(([id, entries]) => [id, entries.filter(item => item.id !== commentId)])
      ));
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Suppression du commentaire impossible.');
    } finally {
      setBusyCommentId(null);
    }
  }

  function renderComment(item: Comment, depth: number): React.ReactNode {
    const canDelete = item.author.id === user?.id || post?.authorId === user?.id;
    const children = repliesByParent[item.id] ?? [];
    const currentReaction = reactionSummaries[item.id];
    const isExpanded = expandedReplies.includes(item.id);
    const count = item._count?.replies ?? 0;
    return (
      <div className="km-comment-thread" key={item.id}>
        <article className={`km-post-comment ${depth > 0 ? 'km-post-comment--reply' : ''}`}
          id={`knowme-comment-${item.id}`}
          onContextMenu={event => {
            event.preventDefault();
            clearHold();
            setContextCommentId(item.id);
          }}
          onPointerDown={event => {
            if (event.pointerType !== 'mouse') {
              clearHold();
              holdTimer.current = window.setTimeout(() => setContextCommentId(item.id), 440);
            }
          }}
          onPointerUp={clearHold}
          onPointerCancel={clearHold}
          onPointerLeave={clearHold}
          style={{
            marginLeft: depth > 0 ? Math.min(depth, 3) * 18 : 0,
            outline: targetComment === item.id ? '2px solid var(--mint)' : undefined
          }}>
          <div className="km-post-comment-avatar">
            {item.author.avatarUrl
              ? <img src={item.author.avatarUrl} alt=""/>
              : item.author.displayName.charAt(0)}
          </div>
          <div className="km-post-comment-content">
            <Link href={`/profile/${encodeURIComponent(item.author.username)}`}>
              <strong style={{display:'inline-flex',gap:5,alignItems:'center'}}>
                {item.author.displayName}
                <AccountBadges username={item.author.username} staff={item.author.staff}
                  verification={item.author.verification} compact/>
              </strong>
              <small>@{item.author.username}</small>
            </Link>
            <p><KnowMeMentionText text={item.content}/></p>
            <div className="km-post-comment-actions">
              <small>{new Date(item.createdAt).toLocaleString('fr-FR')}</small>
              <button type="button" className="km-comment-react-button"
                disabled={reactionBusy===item.id}
                aria-label={`Réagir au commentaire de ${item.author.displayName}`}
                aria-pressed={Boolean(currentReaction?.mine)}
                onPointerDown={event=>{
                  event.stopPropagation();
                  suppressReactionClick.current=false;
                  if(event.pointerType!=='mouse'){
                    cancelReactionHold();
                    reactionHold.current=window.setTimeout(()=>{
                      suppressReactionClick.current=true;
                      openReactionPicker(item.id);
                    },420);
                  }
                }}
                onPointerUp={event=>{event.stopPropagation();cancelReactionHold();}}
                onPointerCancel={event=>{event.stopPropagation();cancelReactionHold();}}
                onContextMenu={event=>{event.preventDefault();event.stopPropagation();openReactionPicker(item.id);}}
                onClick={event=>{
                  event.stopPropagation();
                  if(suppressReactionClick.current){suppressReactionClick.current=false;return;}
                  void reactToComment(item.id,currentReaction?.mine??'❤️');
                }}>
                {currentReaction?.mine || 'Réagir'}
                {Boolean(currentReaction?.total) && <span className="km-comment-reaction-count"> {currentReaction.total}</span>}
              </button>
              <button type="button" aria-label={`Choisir une réaction pour le commentaire de ${item.author.displayName}`}
                onClick={()=>openReactionPicker(item.id)}>☺</button>
              <button type="button" onClick={() => beginReply(item)}>Répondre</button>
              <button type="button" onClick={() => void copyLink('comment', item.id)}>Lien</button>
              <button type="button" onClick={() => setContextCommentId(item.id)}
                aria-label={`Actions pour le commentaire de ${item.author.displayName}`}>⋯</button>
              {canDelete && <button type="button" disabled={busyCommentId === item.id}
                onClick={() => void removeComment(item.id)}>
                {busyCommentId === item.id ? 'Suppression…' : 'Supprimer'}
              </button>}
            </div>
            {currentReaction && currentReaction.emojis.length>0 && (
              <div className="km-comment-reaction-breakdown">
                {currentReaction.emojis.slice(0,5).map(r=>(
                  <span key={r.emoji}>{r.emoji} {r.count}</span>
                ))}
              </div>
            )}
            {(count > 0 || children.length > 0) && (
              <button className="km-comment-thread-toggle" type="button"
                disabled={loadingReplies === item.id}
                onClick={() => void showReplies(item)}>
                {loadingReplies === item.id ? 'Chargement…'
                  : isExpanded ? 'Masquer les réponses'
                  : `Afficher les réponses (${count || children.length})`}
              </button>
            )}
          </div>
        </article>
        {isExpanded && children.length > 0 && (
          <div className="km-comment-thread-children">
            {children.map(child => renderComment(child, depth + 1))}
            {replyMoreByParent[item.id] && (
              <button className="km-comment-thread-toggle" type="button"
                disabled={loadingReplies === item.id}
                onClick={() => void showReplies(item, true)}>
                Voir les réponses suivantes
              </button>
            )}
          </div>
        )}
      </div>
    );
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
            <span><strong style={{display:'inline-flex',gap:5,alignItems:'center'}}>{post.author.displayName}<AccountBadges username={post.author.username} staff={post.author.staff} verification={post.author.verification} compact/></strong><small>@{post.author.username} · {new Date(post.createdAt).toLocaleDateString('fr-FR')}</small></span>
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
        <PostMediaCollage media={post.media} fallbackUrl={post.imageUrl}
          caption={post.content}/>
        <PostActionBar postId={post.id} en={false}
          likeCount={post._count.likes} commentCount={post._count.comments}
          selectedReaction={myLike===true?'❤️':null}
          online={myLike!==null&&!likeBusy}
          onHeart={like}
          onReact={async emoji=>{if(emoji==='❤️')await like();
            else throw new Error('Cette réaction n’est pas encore disponible sur le serveur.');}}
          onComments={()=>document.getElementById('km-post-comments')?.scrollIntoView({behavior:'smooth',block:'start'})}
          onShare={()=>{void sharePost();}}
        />
      </article>

      <div className="km-post-comments-heading">
        <h2>Commentaires <span>{post._count.comments}</span></h2>
      </div>

      <section id="km-post-comments" className="km-post-comments" aria-label="Commentaires">
        {comments.map(item => renderComment(item, 0))}


        {!comments.length && <div className="km-post-comments-empty"><span aria-hidden="true">☏</span><p>Sois le premier à commenter.</p></div>}
      </section>

      {reactionPickerFor && (
        <div className="km-comment-reaction-overlay" role="presentation"
          onMouseDown={event=>{if(event.target===event.currentTarget)setReactionPickerFor(null);}}>
          <section role="dialog" aria-modal="true" className="km-comment-reaction-picker"
            aria-label="Choisir une réaction">
            <header><strong>Réagir au commentaire</strong>
              <button type="button" onClick={()=>setReactionPickerFor(null)} aria-label="Fermer">×</button>
            </header>
            <div className="km-comment-reaction-options">
              {QUICK_REACTIONS.map(emoji=>(
                <button type="button" key={emoji} disabled={Boolean(reactionBusy)}
                  aria-label={`Réagir avec ${emoji}`}
                  onClick={()=>void reactToComment(reactionPickerFor,emoji)}>{emoji}</button>
              ))}
              <button type="button" aria-label="Plus d’emojis"
                onClick={()=>setMoreReactions(value=>!value)}>+</button>
            </div>
            {moreReactions && (
              <form className="km-comment-reaction-more" onSubmit={event=>{
                event.preventDefault();
                if(customEmoji.trim()) void reactToComment(reactionPickerFor,customEmoji.trim());
              }}>
                <label htmlFor="km-custom-reaction">Choisis un emoji avec ton clavier</label>
                <input id="km-custom-reaction" value={customEmoji}
                  maxLength={32} onChange={e=>setCustomEmoji(e.target.value)}
                  placeholder="😊" autoFocus/>
                <button type="submit" disabled={!customEmoji.trim() || Boolean(reactionBusy)}>Valider</button>
              </form>
            )}
          </section>
        </div>
      )}
      {selectedComment && (
        <div className="km-comment-actions-overlay" role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setContextCommentId(null);
          }}>
          <section className="km-comment-actions-sheet" role="dialog" aria-modal="true"
            aria-label={`Actions sur le commentaire de ${selectedComment.author.displayName}`}>
            <div className="km-comment-actions-handle" aria-hidden="true"/>
            <header>
              <strong>{selectedComment.author.displayName}</strong>
              <button type="button" onClick={() => setContextCommentId(null)}
                aria-label="Fermer les actions">×</button>
            </header>
            <p className="km-comment-actions-preview">{selectedComment.content}</p>
            <button type="button" onClick={() => beginReply(selectedComment)}>
              Répondre
            </button>
            {selectedComment.author.id === user?.id && (
              <button type="button" onClick={() => {
                setEditDraft(selectedComment.content);
                setEditFeedback('');
                setEditingComment(selectedComment);
                setContextCommentId(null);
              }}>Modifier le commentaire</button>
            )}
            <button type="button" autoFocus onClick={() => void copyCommentText(selectedComment)}>
              Copier le texte
            </button>
            {selectedComment.author.id !== user?.id && (
              <button type="button" onClick={() => {
                setReportingComment(selectedComment);
                setContextCommentId(null);
              }}>Signaler le commentaire</button>
            )}
            <button type="button" onClick={() => {
              const id = selectedComment.id;
              setContextCommentId(null);
              void copyLink('comment', id);
            }}>Copier le lien</button>
            {(selectedComment.author.id === user?.id || post.authorId === user?.id) && (
              <button type="button" className="km-comment-actions-danger"
                disabled={busyCommentId === selectedComment.id}
                onClick={() => {
                  const id = selectedComment.id;
                  setContextCommentId(null);
                  void removeComment(id);
                }}>Supprimer le commentaire</button>
            )}
          </section>
        </div>
      )}

      {reportingComment && (
        <CommentReportSheet comment={reportingComment}
          onClose={() => setReportingComment(null)}
          onReported={() => {
            setShareNotice('Signalement transmis à la modération KnowMe.');
          }} />
      )}

      {editingComment && (
        <div className="km-comment-actions-overlay" role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !savingEdit) setEditingComment(null);
          }}>
          <form className="km-comment-actions-sheet km-comment-edit-sheet"
            role="dialog" aria-modal="true" aria-label="Modifier le commentaire"
            onSubmit={event => void submitCommentEdit(event)}>
            <div className="km-comment-actions-handle" aria-hidden="true"/>
            <header>
              <strong>Modifier le commentaire</strong>
              <button type="button" onClick={() => setEditingComment(null)}
                disabled={savingEdit} aria-label="Annuler la modification">×</button>
            </header>
            <label htmlFor="km-comment-edit-draft">Texte du commentaire</label>
            <textarea id="km-comment-edit-draft" autoFocus value={editDraft}
              onChange={event => setEditDraft(event.target.value)}
              maxLength={500} rows={4} disabled={savingEdit} />
            <small>{editDraft.length} / 500</small>
            {editFeedback && <p role="alert">{editFeedback}</p>}
            <div className="km-comment-edit-actions">
              <button type="button" disabled={savingEdit}
                onClick={() => setEditingComment(null)}>Annuler</button>
              <button type="submit" disabled={savingEdit || !editDraft.trim()}>
                {savingEdit ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
          <button className="btn" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? 'Chargement…' : 'Afficher plus de commentaires'}
          </button>
        </div>
      )}
      {replyTarget && (
        <div className="km-comment-reply-indicator">
          <span>Réponse à <strong>{replyTarget.author.displayName}</strong></span>
          <button type="button" onClick={() => setReplyTarget(null)}
            aria-label="Annuler la réponse">×</button>
        </div>
      )}
      <form className="km-post-comment-form" onSubmit={comment}>
        <label className="km-sr-only" htmlFor="km-post-comment-draft">Ton commentaire</label>
        <textarea id="km-post-comment-draft" name="content" rows={1} placeholder={replyTarget ? `Répondre à ${replyTarget.author.displayName}…` : 'Écris un commentaire…'} maxLength={500} required aria-label="Commentaire" />
        <button type="submit" disabled={sending} aria-label="Envoyer le commentaire">{sending ? 'Envoi…' : 'Envoyer'}</button>
      </form>
    </main>
  );
}
