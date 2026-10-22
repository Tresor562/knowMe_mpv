'use client';

import Link from 'next/link';
import { RuntimeExperienceModules } from '../../components/runtime-experience-modules';
import { PostShareSheet } from '../../components/post-share-sheet';
import { PostMediaCollage, type PostMediaItem } from '../../components/post-media-collage';
import { PostActionBar } from '../../components/PostActionBar';
import '../../components/post-share-sheet.css';
import { PostOptionsSheet, PostDisinterestSheet } from '../../components/post-options-sheet';
import { PostEditSheet } from '../../components/post-edit-sheet';
import '../../components/post-options-sheet.css';
import { KnowMeMentionText } from '../../components/knowme-mention-text';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { saveOfflineFeed, loadOfflineFeed } from '../../lib/offline-feed';
import { loadPostDraft, savePostDraft, clearPostDraft } from '../../lib/offline-post-draft';
import { useSession } from '../../lib/use-session';
import { StoriesRail } from './StoriesRail';
import { ReelSuggestionsRail } from './ReelSuggestionsRail';
import './multi-media-composer.css';
import './reference-home.css';
import { useI18n } from '../../components/i18n-provider';
import { KnowMeAvatarImage } from '../../components/knowme-avatar-image';
import { AccountBadges } from '../../components/AccountBadges';
import type {StaffBadge, VerificationBadge} from '../../lib/use-session';

type PostUploadSession = { id: string; uploadToken: string };
type PostUploadedAsset = { id: string; status: string; scannerVerdict?: string };

type Post = {
  id: string;
  content: string;
  imageUrl?: string | null;
  media?: PostMediaItem[];
  createdAt: string;
  author: { id: string; username: string; displayName: string; avatarUrl?: string | null; staff?: StaffBadge | null; verification?: VerificationBadge | null };
  _count: { likes: number; comments: number };
};

const FEED_PAGE_SIZE = 20;

export default function FeedPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const { locale } = useI18n();
  const en = locale === 'en';
  const [feedMenuOpen, setFeedMenuOpen] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reelsAfterPost, setReelsAfterPost] = useState<number | null>(null);
  const feedVisitSlot=useRef(Math.floor(Date.now()/3600000));
  const [myLikes, setMyLikes] = useState<Record<string, boolean>>({});
  const [busyLikeIds, setBusyLikeIds] = useState<string[]>([]);
  const likesInFlight = useRef(new Set<string>());
  const likesRevision = useRef(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [message, setMessage] = useState('');
  const [publishMessage, setPublishMessage] = useState('');
  const publishInFlight = useRef(false);
  const [shareNotice, setShareNotice] = useState('');
  const [sharingPost, setSharingPost] = useState<Post | null>(null);
  const [optionsPost, setOptionsPost] = useState<Post | null>(null);
  const [editPost,setEditPost] = useState<Post|null>(null);
  const [disinterestPost, setDisinterestPost] = useState<Post | null>(null);
  const [hiddenPostIds, setHiddenPostIds] = useState<Set<string>>(() => new Set());
  const [recentlyHiddenPostId, setRecentlyHiddenPostId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [composeOpen,setComposeOpen] = useState(false);
  const [draftContent,setDraftContent] = useState('');
  const [draftOwner,setDraftOwner] = useState('');
  const [draftStatus,setDraftStatus] = useState('');
  const [missingDraftMedia,setMissingDraftMedia] = useState<string[]>([]);
  const [offline,setOffline] = useState(false);
  const draftWrites = useRef<Promise<unknown>>(Promise.resolve());
  const [deletePending,setDeletePending] = useState<string|null>(null);
  const [selectedMedia, setSelectedMedia] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<Array<{ file: File; url: string | null }>>([]);
  const [photoCapability, setPhotoCapability] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  // A draft never crosses account boundaries on a shared device.
  useEffect(() => {
    let cancelled = false;
    setDraftOwner('');
    setDraftContent('');
    setSelectedMedia([]);
    setMissingDraftMedia([]);
    setDraftStatus('');
    if (!user?.id || sessionLoading) return () => { cancelled = true; };
    const accountId = user.id;
    void loadPostDraft(accountId).then(saved => {
      if (cancelled) return;
      if (saved) {
        setDraftContent(saved.content);
        setSelectedMedia(saved.files);
        setMissingDraftMedia(saved.missingAttachmentNames);
        setDraftStatus(saved.missingAttachmentNames.length
          ? (en ? 'Text restored. Re-select attachments that exceeded device storage.'
                : 'Texte restauré. Sélectionne à nouveau les médias non enregistrés.')
          : (en ? 'Offline draft restored on this device.' : 'Brouillon hors ligne restauré sur cet appareil.'));
      }
    }).catch(() => {
      if (!cancelled) setDraftStatus(en ? 'Offline storage unavailable on this device.'
        : 'Enregistrement hors ligne indisponible sur cet appareil.');
    }).finally(() => {
      if (!cancelled) setDraftOwner(accountId);
    });
    return () => { cancelled = true; };
  }, [user?.id, sessionLoading]);

  useEffect(() => {
    if (!user?.id || draftOwner !== user.id || publishing) return;
    const accountId = user.id;
    const content = draftContent;
    const files = selectedMedia.slice();
    const timeout = window.setTimeout(() => {
      // Serialize writes: a delayed large media write cannot overwrite a newer draft.
      const write = draftWrites.current.catch(() => undefined)
        .then(() => savePostDraft(accountId, content, files));
      draftWrites.current = write;
      void write.then(result => {
        setMissingDraftMedia(result.attachmentsSaved ? [] : files.map(file => file.name));
        setDraftStatus(result.attachmentsSaved
          ? (content || files.length
            ? (en ? 'Draft saved offline on this device.' : 'Brouillon enregistré hors ligne sur cet appareil.')
            : '')
          : (en ? 'Text saved. Attachments could not fit in device storage.'
                : 'Texte enregistré. Espace insuffisant pour les pièces jointes.'));
      }).catch(() => {
        setDraftStatus(en ? 'Draft not saved on this device.' : 'Brouillon non enregistré sur cet appareil.');
      });
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [user?.id, draftOwner, draftContent, selectedMedia, publishing, en]);

  // The global Create → Publication action must open the real post editor,
  // including when navigating from another section of KnowMe. Consume the hash
  // so the same action can open the editor again after it has been closed.
  useEffect(() => {
    const openLinkedComposer = () => {
      if (window.location.hash !== '#compose') return;
      setComposeOpen(true);
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    };
    openLinkedComposer();
    window.addEventListener('hashchange', openLinkedComposer);
    const openFromMainNavigation = () => setComposeOpen(true);
    window.addEventListener('knowme:open-post-composer', openFromMainNavigation);
    return () => {
      window.removeEventListener('hashchange', openLinkedComposer);
      window.removeEventListener('knowme:open-post-composer', openFromMainNavigation);
    };
  }, []);
  // Choose a bounded insertion point once per mounted feed: new pages never shift the strip.
  useEffect(() => {
    if (!user?.id || !posts.length || reelsAfterPost !== null) return;
    const seed = [...(user.id+':'+feedVisitSlot.current)].reduce((value,char)=>((value*31)+char.charCodeAt(0))>>>0,0);
    setReelsAfterPost(Math.min(posts.length,1+(seed%6)));
  }, [user?.id,posts.length,reelsAfterPost]);

  const [authorityFresh, setAuthorityFresh] = useState(false);
  const [showingCache,setShowingCache] = useState(false);
  const loadGeneration = useRef(0);

  useEffect(()=>{
    if(!composeOpen)return;
    const previousFocus=document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    if(window.innerWidth>760)composerInputRef.current?.focus();
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!publishing)setComposeOpen(false);
    };
    window.addEventListener('keydown',onKey);
    return ()=>{
      document.body.style.overflow=previousOverflow;
      window.removeEventListener('keydown',onKey);
      previousFocus?.focus();
    };
  },[composeOpen,publishing]);

  useEffect(() => {
    let active = true;
    setPhotoCapability(false);
    if (sessionLoading || !user) return;
    void apiFetch<{ publicPostImage: boolean }>('/media/public/post-capabilities')
      .then(result => { if (active) setPhotoCapability(Boolean(result.publicPostImage)); })
      .catch(() => { if (active) setPhotoCapability(false); });
    return () => { active = false; };
  }, [sessionLoading, user?.id]);

  useEffect(() => {
    const previews = selectedMedia.map(file => ({
      file, url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    }));
    setMediaPreviews(previews);
    return () => {
      for (const preview of previews) if (preview.url) URL.revokeObjectURL(preview.url);
    };
  }, [selectedMedia]);

  function selectMedia(files: FileList | null) {
    if (!files?.length) return;
    const next = [...files];
    const allowed = new Set(['image/jpeg','image/png','image/webp','image/gif','video/mp4']);
    if (next.some(file => !allowed.has(file.type) || file.size < 1024 || file.size > 25 * 1024 * 1024)) {
      setPublishMessage(en
        ? 'Choose JPG, PNG, WebP, GIF or MP4 files between 1 KB and 25 MB each.'
        : 'Choisis des fichiers JPG, PNG, WebP, GIF ou MP4 de 1 Ko à 25 Mo chacun.');
      return;
    }
    if (selectedMedia.length + next.length > 500) {
      setPublishMessage(en
        ? 'This server accepts a maximum of 500 files per publication.'
        : 'Ce serveur accepte au maximum 500 médias par publication.');
      return;
    }
    setPublishMessage('');
    setSelectedMedia(current => [...current, ...next]);
  }

  const invalidateFeedAuthority = useCallback(() => {
    loadGeneration.current += 1;
    setAuthorityFresh(false);
    setShowingCache(false);
    setPosts([]);
    setHasMore(false);
    setLoadingMore(false);
  }, []);

  const loadFeed = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setAuthorityFresh(false);
    setShowingCache(false);
    // Keep previously loaded posts visible during transient network failures.
    setMessage('');

    try {
      const firstPage = await apiFetch<Post[]>('/posts/feed');
      if (generation !== loadGeneration.current) return;
      setPosts(firstPage);
      setHasMore(firstPage.length === FEED_PAGE_SIZE);
      setAuthorityFresh(true);
      if(user?.id)void saveOfflineFeed(user.id,firstPage).catch(()=>{
        // Browsers with storage disabled still get the current online feed.
      });
    } catch (cause) {
      if (generation !== loadGeneration.current) return;
      setAuthorityFresh(false);
      // The cache contains only public feed text/metadata previously loaded
      // by this account. It never implies that network actions will succeed.
      let restored=false;
      if(user?.id){
        try{
          const saved=await loadOfflineFeed(user.id);
          if(generation!==loadGeneration.current)return;
          if(saved?.posts.length){
            setPosts(saved.posts as Post[]);
            setHasMore(false);
            setShowingCache(true);
            const when=new Date(saved.updatedAt).toLocaleString(en?'en-US':'fr-FR');
            setMessage(en
              ? 'Offline snapshot from '+when+'. Posts are read-only; media not cached may need Internet.'
              : 'Fil hors ligne du '+when+'. Publications en lecture seule ; certains médias nécessitent Internet.');
            restored=true;
          }
        }catch{/* Local storage unavailable: show the genuine network error. */}
      }
      if(generation!==loadGeneration.current)return;
      if(!restored)setMessage(cause instanceof Error ? cause.message : 'Fil indisponible.');
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, [user?.id,en]);

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
    if (publishInFlight.current) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const content = String(data.get('content') ?? '').trim();
    if (!content && selectedMedia.length === 0) return;
    if (offline) {
      setPublishMessage(en ? 'You are offline. Your draft stays on this device until you reconnect.'
        : 'Tu es hors ligne. Ton brouillon reste sur cet appareil jusqu’au retour de la connexion.');
      return;
    }

    publishInFlight.current = true;
    setPublishing(true);
    setPublishMessage('');
    try {
      const mediaAssetIds: string[] = [];
      for (let index = 0; index < selectedMedia.length; index += 1) {
        const file = selectedMedia[index]!;
        setPublishMessage(en
          ? `Uploading media ${index + 1} of ${selectedMedia.length}…`
          : `Envoi du média ${index + 1} sur ${selectedMedia.length}…`);
        const session = await apiFetch<PostUploadSession>('/media/uploads', {
          method: 'POST',
          body: JSON.stringify({
            purpose: 'POST', visibility: 'PRIVATE', maxBytes: file.size,
            allowedMime: [file.type]
          })
        });
        const upload = new FormData();
        upload.append('file', file, file.name);
        const asset = await apiFetch<PostUploadedAsset>(
          `/media/uploads/${encodeURIComponent(session.id)}/complete`, {
            method: 'POST',
            headers: { 'x-upload-token': session.uploadToken },
            body: upload
          }
        );
        if (asset.status !== 'AVAILABLE') {
          throw new Error(en
            ? 'A media file failed the security check. Your draft is kept.'
            : 'Un média a échoué au contrôle de sécurité. Le brouillon est conservé.');
        }
        mediaAssetIds.push(asset.id);
      }
      setPublishMessage(en ? 'Publishing…' : 'Publication en cours…');
      await apiFetch('/posts', {
        method: 'POST',
        body: JSON.stringify({content, ...(mediaAssetIds.length ? {mediaAssetIds} : {})})
      });
      // Clear only AFTER the server confirms the publication. A network
      // timeout must never erase a draft or retry a non-idempotent POST.
      await draftWrites.current.catch(() => undefined);
      await clearPostDraft(user!.id).catch(() => undefined);
      form.reset();
      setSelectedMedia([]);
      setDraftContent('');
      setMissingDraftMedia([]);
      setDraftStatus('');
      setPublishMessage('');
      setComposeOpen(false);
      await loadFeed();
    } catch (cause) {
      // A failed upload must never erase the draft or disable the composer.
      // In particular, do not retry an uncertain POST automatically:
      // the server may have accepted it before the response was lost.
      const error = cause as { code?: string; message?: string };
      const uncertain = error?.code === 'KNOWME_TIMEOUT' || error?.code === 'KNOWME_NETWORK_UNAVAILABLE';
      setPublishMessage(uncertain
        ? (en
          ? 'Publication not confirmed. Check your profile before trying again to avoid a duplicate.'
          : 'Publication non confirmée. Vérifie ton profil avant de réessayer pour éviter un doublon.')
        : cause instanceof Error ? cause.message : (en ? 'Could not publish.' : 'Publication impossible.'));
    } finally {
      publishInFlight.current = false;
      setPublishing(false);
    }
  }

  // Re-read the authenticated user's own reaction state for every newly loaded
  // post page. A public likes count never tells us whether *I* have liked it.
  const visiblePostIds = posts.map(post => post.id).join(',');
  useEffect(() => {
    let active = true;
    const revision=likesRevision.current;
    setMyLikes({});
    if (!user?.id || !authorityFresh || !visiblePostIds) return () => {active = false;};
    const ids = visiblePostIds.split(',');
    void Promise.all(Array.from({length:Math.ceil(ids.length/50)}, (_,index) => {
      const batch = ids.slice(index*50,index*50+50);
      return apiFetch<Record<string,boolean>>(`/post-like-status?ids=${encodeURIComponent(batch.join(','))}`);
    })).then(pages => {
      if (active && revision===likesRevision.current) setMyLikes(Object.assign({},...pages));
    }).catch(() => {
      // Unknown is not "unliked": never cache an invented personal reaction.
    });
    return () => {active = false;};
  },[user?.id,authorityFresh,visiblePostIds]);

  async function toggleLike(postId: string) {
    if (!authorityFresh || !user?.id || likesInFlight.current.has(postId)) return;
    likesInFlight.current.add(postId);
    setBusyLikeIds(current => [...current,postId]);
    const accountId = user.id;
    const generation = loadGeneration.current;
    try {
      const result = await apiFetch<{ liked: boolean }>(`/posts/${encodeURIComponent(postId)}/like`, { method: 'POST' });
      if (generation!==loadGeneration.current || accountId!==user?.id) return;
      likesRevision.current+=1;
      setMyLikes(current=>({...current,[postId]:result.liked}));
      setPosts(current=>current.map(post=>post.id===postId
        ? {...post,_count:{...post._count,likes:Math.max(0,post._count.likes+(result.liked?1:-1))}}
        : post));
    } catch (cause) {
      if(generation===loadGeneration.current) {
        setMessage(cause instanceof Error?cause.message:'Réaction non confirmée.');
      }
    } finally {
      likesInFlight.current.delete(postId);
      setBusyLikeIds(current=>current.filter(id=>id!==postId));
    }
  }

  async function deletePost(id: string) {
    if (!authorityFresh || !user) return;
    try {
      await apiFetch(`/posts/${encodeURIComponent(id)}`, {method:'DELETE'});
      setPosts(current=>current.filter(post=>post.id!==id));
      setDeletePending(null);
    } catch (cause) {
      setDeletePending(null);
      setMessage(cause instanceof Error ? cause.message :
        (en ? 'Could not delete this post.' : 'Suppression impossible.'));
    }
  }

  async function copyPostLink(post: Post) {
    const url = `${window.location.origin}/feed/${encodeURIComponent(post.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareNotice(en ? 'Link copied.' : 'Lien copié.');
    } catch {
      setShareNotice(en ? 'Could not copy link on this device.' : 'Impossible de copier le lien sur cet appareil.');
    }
  }

  function sharePost(post: Post) {
    setSharingPost(post);
  }

  if (sessionLoading || !user) return <main className="shell"><p>Chargement du fil...</p></main>;

  return (
    <main className="shell km-feed-page">
      <RuntimeExperienceModules />
      <div className="km-header-nav-group">
      <header className="km-feed-header km-feed-reference-header">
        <h1 className="km-feed-semantic-title">{en ? 'Feed' : 'Fil d’actualité'}</h1>
        <Link href="/feed" className="km-feed-reference-brand" aria-label="KnowMe — Accueil">
          <img src="/brand/knowme-logo.svg" alt="" width="44" height="44" />
          <strong>KnowMe</strong>
        </Link>
        <div className="km-feed-reference-actions">
          <Link className="km-feed-reference-icon" href="/discover"
            aria-label={en ? 'Search KnowMe' : 'Rechercher sur KnowMe'}>
            <svg viewBox="0 0 24 24" width="25" height="25" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.2"/><path d="m16.3 16.3 5 5"/></svg>
          </Link>
          <div className="km-feed-reference-menu-anchor">
            <button type="button" className="km-feed-reference-icon"
              aria-label={en ? 'More options' : 'Plus d’options'}
              aria-expanded={feedMenuOpen} aria-haspopup="menu"
              onClick={() => setFeedMenuOpen(open => !open)}>
              <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"
                aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
            </button>
            {feedMenuOpen && <>
              <button type="button" className="km-feed-reference-scrim"
                aria-label={en ? 'Close menu' : 'Fermer le menu'}
                onClick={() => setFeedMenuOpen(false)} />
              <nav className="km-feed-reference-menu" aria-label={en ? 'Feed menu' : 'Menu du fil'}>
                <button type="button" onClick={() => { setFeedMenuOpen(false); setComposeOpen(true); }}>
                  {en ? 'Create a post' : 'Créer une publication'}
                </button>
                <Link href="/reels" onClick={() => setFeedMenuOpen(false)}>Reels · Vidéos</Link>
                <Link href="/profile" onClick={() => setFeedMenuOpen(false)}>{en ? 'My profile' : 'Mon profil'}</Link>
              </nav>
            </>}
          </div>
        </div>
      </header>
      <div className="km-joined-nav-slot" data-knowme-header-nav-slot="true" />
      </div>
      <section className="km-feed-quick-compose" aria-label={en?'Create a post':'Créer une publication'}>
        <span className="km-post-avatar"><KnowMeAvatarImage src={user.avatarUrl} name={user.displayName} /></span>
        <button type="button" className="km-feed-quick-compose-open"
          aria-label={en?'Open editor':'Ouvrir l’éditeur'}
          onClick={()=>setComposeOpen(true)}>
          {draftContent || (en?'What would you like to share?':'Qu’as-tu envie de partager ?')}
        </button>
      </section>
      <StoriesRail />
      {composeOpen && <div className="km-feed-editor-overlay" role="presentation" onMouseDown={event=>{
        if(event.target===event.currentTarget&&!publishing)setComposeOpen(false);
      }}>
      <form id="compose" role="dialog" aria-modal="true"
        aria-label={en?'Create a post':'Créer une publication'}
        className="km-feed-composer km-feed-editor-form" onSubmit={publish}>
        <div className="km-feed-editor-header">
          <button type="button" aria-label={en?'Close editor':'Fermer l’éditeur'} disabled={publishing}
            className="km-feed-editor-back" onClick={()=>setComposeOpen(false)}>‹</button>
          <h2>{en?'Create a post':'Créer une publication'}</h2>
          <button className="btn btn-primary" type="submit" disabled={publishing||offline||(!draftContent.trim() && !selectedMedia.length)}>
            {publishing?(en?'Publishing…':'Publication…'):(en?'Post':'Publier')}
          </button>
        </div>
        <div className="km-feed-editor-identity">
          <Link href="/profile" className="km-post-avatar" aria-label={en?'My profile':'Mon profil'}>
            <KnowMeAvatarImage src={user.avatarUrl} name={user.displayName} />
          </Link>
          <div>
            <strong>{user.displayName}</strong>
            <span className="km-feed-editor-audience">{en?'Public':'Public'}</span>
          </div>
        </div>
        <input ref={photoInputRef} type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"
          multiple disabled={publishing} className="km-visually-hidden-file"
          aria-label={en ? 'Select several photos and videos' : 'Sélectionner plusieurs photos et vidéos'}
          onChange={event => {
            selectMedia(event.currentTarget.files);
            event.currentTarget.value = '';
          }}/>
        <div className="km-feed-compose-row">
          <textarea name="content" ref={composerInputRef} value={draftContent} onChange={event=>setDraftContent(event.target.value)}
            placeholder={en?'What would you like to share?':'Qu’as-tu envie de partager ?'}
            rows={7} disabled={publishing}/>
        </div>
        <small className="km-feed-editor-counter">{draftContent.length} {en ? "characters" : "caractères"}</small>
        {offline && <p className="km-feed-draft-offline" role="status">
          {en ? 'Offline: keep writing. Publishing requires a connection.'
              : 'Hors ligne : tu peux continuer à écrire. La publication nécessite Internet.'}
        </p>}
        {draftStatus && <p className="km-feed-draft-status" role="status">{draftStatus}</p>}
        {missingDraftMedia.length > 0 && <p className="km-feed-draft-warning" role="alert">
          {en ? 'Select these files again before publishing:' : 'Sélectionne de nouveau ces fichiers avant de publier :'}
          {' '}{missingDraftMedia.join(', ')}
        </p>}
        {mediaPreviews.length > 0 && (
          <div className="km-feed-selected-media"
            aria-label={en ? 'Selected media' : 'Médias sélectionnés'}>
            <div className="km-feed-selected-media-heading">
              <strong>{en ? 'Attachments' : 'Pièces jointes'} ({mediaPreviews.length})</strong>
              <button type="button" disabled={publishing} onClick={() => setSelectedMedia([])}>
                {en ? 'Remove all' : 'Tout retirer'}
              </button>
            </div>
            <div className="km-feed-selected-media-grid">
              {mediaPreviews.map(({file,url},index) => (
                <div className="km-feed-selected-media-item" key={index}>
                  {url
                    ? <img src={url} alt={file.name}/>
                    : <span className="km-feed-selected-media-video">
                        <span aria-hidden="true">▶</span><span>MP4</span>
                      </span>}
                  <span className="km-feed-selected-media-filename" title={file.name}>{file.name}</span>
                  <button type="button" disabled={publishing}
                    aria-label={en ? `Remove ${file.name}` : `Retirer ${file.name}`}
                    onClick={() => setSelectedMedia(current => current.filter((_,i) => i !== index))}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="km-feed-compose-actions">
          <div className="km-feed-compose-tools">
            {photoCapability && <button type="button" disabled={publishing} onClick={() => photoInputRef.current?.click()}>
              <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="3"/>
                <circle cx="8" cy="9" r="1.4"/><path d="m4 17 5-5 3.5 3.5 3-3L21 18"/>
              </svg>
              {en ? 'Photos / videos' : 'Photos / vidéos'}
            </button>}
            <Link href="/stories/new">{en?'Add a story':'Ajouter une story'}</Link>
          </div>
          <button className="btn btn-primary" type="submit" disabled={publishing || offline || (!draftContent.trim() && !selectedMedia.length)}>
            {publishing ? (en?'Publishing…':'Publication…') : (en?'Publish':'Publier')}
          </button>
        </div>
        {publishMessage && <p role="alert" style={{color:'var(--orange)',fontSize:13}}>{publishMessage}</p>}
      </form>
      </div>}

      {!authorityFresh && !message && <p style={{ color: 'var(--muted)' }}>{en?'Validating feed…':'Validation du fil…'}</p>}
      {message && <div role="alert" className="km-feed-network-notice" style={{ color: 'var(--muted)' }}>
        <span>{message}</span>{' '}
        <button type="button" className="btn" onClick={() => void loadFeed()} disabled={loading}>
          {en ? 'Retry' : 'Réessayer'}
        </button>
      </div>}
      {shareNotice && <p className="km-feed-notice" role="status" onClick={() => setShareNotice('')}>{shareNotice}</p>}
      {loading && <p>{en?'Loading posts…':'Chargement des publications…'}</p>}

      <section className="km-feed-list" aria-label={en?'Posts':'Publications'}>
        {authorityFresh && !loading && posts.length === 0 && (
          <div className="km-feed-empty">
            <h2>{en?'Nothing here yet':'Le fil est encore calme'}</h2>
            <p>{en?'Be the first to share something.':'Sois la première personne à partager quelque chose.'}</p>
          </div>
        )}

        {(authorityFresh || showingCache) && posts.filter(post => !hiddenPostIds.has(post.id)).map((post, index) => (
          <div key={post.id} className="km-feed-stream-block">
          <article className="km-feed-post">
            <header className="km-post-header">
              <Link className="km-post-author" href={`/profile/${encodeURIComponent(post.author.username)}`}>
                <span className="km-post-avatar">
                  <KnowMeAvatarImage src={post.author.avatarUrl} name={post.author.displayName} />
                </span>
                <span className="km-post-author-copy">
                  <strong style={{display:'inline-flex',gap:5,alignItems:'center'}}>{post.author.displayName}<AccountBadges username={post.author.username} staff={post.author.staff} verification={post.author.verification} compact/></strong>
                  <small>@{post.author.username} · {new Date(post.createdAt).toLocaleDateString(en?'en-US':'fr-FR')}</small>
                </span>
              </Link>
              <div className="km-post-menu">
                <button type="button" className="km-post-hide-trigger"
                  aria-label={en ? 'Post options' : 'Options de la publication'}
                  onClick={() => setOptionsPost(post)}>⋯</button>
                {post.author.id!==user.id && (
                  <button type="button" className="km-post-hide-trigger"
                    aria-label={en ? 'Dismiss this post' : 'Masquer la publication'}
                    onClick={() => setDisinterestPost(post)}>×</button>
                )}
              </div>
            </header>
            {post.content && <div className="km-post-content">
              <p><KnowMeMentionText text={post.content}/></p>
              {authorityFresh ? <Link href={`/feed/${post.id}`} className="km-post-open-link">
                {en ? 'Open post' : 'Voir la publication'}
              </Link> : <span className="km-post-open-link">{en?'Saved offline':'Copie hors ligne'}</span>}
            </div>}
            <PostMediaCollage media={post.media} fallbackUrl={post.imageUrl}
              caption={post.content} en={en}/>
            <footer>
              <PostActionBar postId={post.id} userId={user.id} en={en}
                likeCount={post._count.likes} commentCount={post._count.comments}
                selectedReaction={myLikes[post.id]===true?'❤️':null}
                online={authorityFresh&&!offline&&myLikes[post.id]!==undefined&&!busyLikeIds.includes(post.id)}
                onHeart={()=>toggleLike(post.id)}
                onReact={async emoji=>{if(emoji==='❤️')await toggleLike(post.id);
                  else throw new Error(en?'This reaction is not yet supported by the server.':'Cette réaction n’est pas encore disponible sur le serveur.');}}
                onComments={()=>{if(authorityFresh)window.location.assign(`/feed/${encodeURIComponent(post.id)}#km-post-comments`);}}
                onShare={()=>sharePost(post)}
              />
            </footer>
          </article>
          {index+1 === reelsAfterPost && authorityFresh && <ReelSuggestionsRail en={en}/>}
          </div>
        ))}
      </section>

      {recentlyHiddenPostId && (
        <div className="km-post-dismissed-note" role="status">
          <span>{en?'Publication hidden for this session.':'Publication masquée pour cette session.'}</span>
          <button type="button" onClick={() => {
            setHiddenPostIds(current => {
              const next = new Set(current);
              next.delete(recentlyHiddenPostId);
              return next;
            });
            setRecentlyHiddenPostId(null);
          }}>{en?'Undo':'Annuler'}</button>
        </div>
      )}
      {optionsPost && (
        <PostOptionsSheet post={optionsPost} own={optionsPost.author.id === user.id} en={en}
          onClose={() => setOptionsPost(null)}
          onShare={() => { const target=optionsPost; setOptionsPost(null); sharePost(target); }}
          onCopy={() => { const target=optionsPost; setOptionsPost(null); void copyPostLink(target); }}
          onEdit={() => { if(authorityFresh){setEditPost(optionsPost);setOptionsPost(null);} }}
          onDelete={() => { setDeletePending(optionsPost.id); setOptionsPost(null); }}
          onDisinterest={() => { const target=optionsPost; setOptionsPost(null); setDisinterestPost(target); }}
        />
      )}
      {editPost && authorityFresh && (
        <PostEditSheet post={{
          id:editPost.id,content:editPost.content,
          hasMedia:Boolean(editPost.media?.length||editPost.imageUrl)
        }} en={en}
          onClose={()=>setEditPost(null)}
          onSaved={content=>{
            setPosts(previous=>previous.map(item=>
              item.id===editPost?.id?{...item,content}:item
            ));
          }}/>
      )}
      {disinterestPost && (
        <PostDisinterestSheet en={en} onClose={() => setDisinterestPost(null)}
          onChoose={() => {
            const id=disinterestPost.id;
            setHiddenPostIds(current => new Set([...current, id]));
            setRecentlyHiddenPostId(id);
            setDisinterestPost(null);
          }}
        />
      )}
      {sharingPost && <PostShareSheet post={sharingPost} en={en}
        onClose={() => setSharingPost(null)}
        onPublished={() => {
          setShareNotice(en ? 'Shared on KnowMe.' : 'Partagé sur KnowMe.');
          void loadFeed();
        }}/>}
      {deletePending && <div className="km-post-delete-overlay" role="presentation"
        onMouseDown={event=>{if(event.target===event.currentTarget)setDeletePending(null);}}>
        <section role="alertdialog" aria-modal="true" className="km-post-delete-dialog"
          aria-label={en?'Delete post':'Supprimer la publication'}>
          <h2>{en?'Delete this post?':'Supprimer cette publication ?'}</h2>
          <p>{en?'The post and its comments will be permanently removed.':'La publication et ses commentaires seront supprimés définitivement.'}</p>
          <div className="km-post-delete-actions">
            <button type="button" onClick={()=>setDeletePending(null)}>{en?'Cancel':'Annuler'}</button>
            <button type="button" className="btn btn-primary"
              onClick={()=>void deletePost(deletePending)}>{en?'Delete':'Supprimer'}</button>
          </div>
        </section>
      </div>}

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
