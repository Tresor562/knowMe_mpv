'use client';

import { AccountBadges } from '../../../components/AccountBadges';
import './story-viewer.css';
import Link from 'next/link';
import { KnowMeMentionText } from '../../../components/knowme-mention-text';
import { buildKnowMePublicLink } from '@knowme/link-contract';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch, apiFetchBlob } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';
import { storyUi } from '../story-i18n';
import { useI18n } from '../../../components/i18n-provider';

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
    verification?: import('../../../lib/use-session').VerificationBadge | null;
  } | null;
  metrics: { reactions: number; replies: number };
  viewer: { own: boolean; reaction?: { reaction: string } | null };
};

type Feed = { stories: Story[]; nextCursor: string | null };
type StoryViewer = {
  viewerUserId: string; lastViewedAt: string; viewCount: number;
  reaction?: {reaction:string;customEmojiId?:string|null}|null;
  user?: {username:string;displayName:string;avatarUrl?:string|null}|null;
};
type StoryViewersPage = {uniqueViewers:number;viewers:StoryViewer[];nextCursor?:string|null};

const REACTIONS = ['❤', '😂', '🔥', '👏', '😮', '💯'];
const reactionGlyph=(value:string)=>({LIKE:'❤️',SPARK:'✨',LOVE:'❤️',FIRE:'🔥',WOW:'😮',HAHA:'😂'} as Record<string,string>)[value]??value;

export default function StoryViewerPage() {
  const { locale } = useI18n();
  const en = locale === 'en';
  const ui = storyUi(en ? 'en' : 'fr');
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [story, setStory] = useState<Story | null>(null);
  const [sequence, setSequence] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [paused,setPaused] = useState(false);
  const [insightsOpen,setInsightsOpen] = useState(false);
  const [insights,setInsights] = useState<StoryViewersPage|null>(null);
  const [insightsLoading,setInsightsLoading] = useState(false);
  const [insightsError,setInsightsError] = useState('');
  const [insightsMoreLoading,setInsightsMoreLoading] = useState(false);
  const navigatedStories=useRef(0);
  const elapsedMs = useRef(0);
  const advancing = useRef(false);
  const pressTimer = useRef<number|null>(null);
  const suppressTap = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const touchStartX = useRef<number | null>(null);
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
      // Keep an author's stories next to each other and in publish order.
      // No fake segments: only visible pages actually returned by the API.
      const rows=[...feed.stories];
      if(!rows.some(item=>item.id===current.id))rows.unshift(current);
      const authors=[...new Set(rows.map(item=>item.author?.id??item.id))];
      setSequence(authors.flatMap(authorId=>rows.filter(item=>
        (item.author?.id??item.id)===authorId).reverse()));
      await apiFetch(`/stories/${storyId}/view`, {
        method: 'POST',
        body: JSON.stringify({ completionBps: 0 })
      });
    } catch (cause) {
      setStory(null);
      setSequence([]);
      setMessage(cause instanceof Error ? cause.message : ui.unavailable);
    } finally {
      setLoading(false);
    }
  }, [storyId, ui.unavailable]);

  useEffect(() => {
    if (!sessionLoading && user) void load();
  }, [load, sessionLoading, user?.id]);

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | null = null;
    setMediaUrl(null);
    setMediaLoading(false);
    if (!story?.assetId) return;
    setMediaLoading(true);
    void apiFetchBlob(`/stories/${story.id}/media`)
      .then((blob) => {
        if (disposed) return;
        objectUrl = URL.createObjectURL(blob);
        setMediaUrl(objectUrl);
      })
      .catch((cause) => {
        if (!disposed) { setPaused(true); setMessage(cause instanceof Error ? cause.message : ui.unavailable); }
      })
      .finally(() => {
        if (!disposed) setMediaLoading(false);
      });
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [story?.assetId, story?.id, ui.unavailable]);

  const index = useMemo(() => sequence.findIndex((item) => item.id === storyId), [sequence, storyId]);
  const previousId = index > 0 ? sequence[index - 1]?.id : null;
  const nextId = index >= 0 && index < sequence.length - 1 ? sequence[index + 1]?.id : null;
  const segments = sequence.filter(item=>(item.author?.id??item.id)===(story?.author?.id??story?.id));
  const segmentIndex=Math.max(0,segments.findIndex(item=>item.id===storyId));
  const leaveViewer=useCallback(()=>{
    if(typeof window!=='undefined'&&window.history.length>navigatedStories.current+1){
      window.history.go(-(navigatedStories.current+1));
    }else router.replace('/feed');
  },[router]);

  const goPrevious = useCallback(() => {
    if (previousId) {navigatedStories.current++;router.push(`/stories/${previousId}`);}
  }, [previousId, router]);
  const goNext = useCallback(() => {
    if (nextId) {navigatedStories.current++;router.push(`/stories/${nextId}`);}
    else leaveViewer();
  }, [nextId, router, leaveViewer]);

  const completeAndAdvance = useCallback(() => {
    if (!story || advancing.current) return;
    advancing.current = true;
    void apiFetch(`/stories/${story.id}/view`, {
      method: 'POST', body: JSON.stringify({ completionBps: 10000 })
    }).catch(() => undefined);
    goNext();
  }, [story?.id, goNext]);

  useEffect(() => {
    advancing.current = false;
    elapsedMs.current = 0;
    setProgress(0);
    setPaused(false);
    setInsightsOpen(false);
  }, [story?.id]);

  useEffect(() => {
    if (!story || loading || mediaLoading || paused || insightsOpen || story.type==='VIDEO') return;
    let lastTick = Date.now();
    const duration = 5000;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') { lastTick = Date.now(); return; }
      const now = Date.now();
      elapsedMs.current += now - lastTick;
      lastTick = now;
      const value = Math.min(1, elapsedMs.current / duration);
      setProgress(value);
      if (value >= 1) {
        window.clearInterval(timer);
        completeAndAdvance();
      }
    }, 80);
    return () => window.clearInterval(timer);
  }, [story?.id,story?.type,loading,mediaLoading,paused,insightsOpen,completeAndAdvance]);

  function setPlaybackPaused(value:boolean) {
    setPaused(value);
    if (story?.type !== 'VIDEO') return;
    if (value) videoRef.current?.pause();
    else void videoRef.current?.play().catch(() => undefined);
  }

  function startHold() {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      suppressTap.current = true;
      setPlaybackPaused(true);
    }, 230);
  }
  function releaseHold() {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
    if (paused) setPlaybackPaused(false);
  }
  function navigateStory(direction:'next'|'previous') {
    if (suppressTap.current) { suppressTap.current = false; return; }
    direction === 'next' ? goNext() : goPrevious();
  }

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') goPrevious();
      if (event.key === 'ArrowRight') goNext();
      if (event.key === 'Escape') {
        if(insightsOpen)setInsightsOpen(false);
        else leaveViewer();
      }
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [goNext, goPrevious, leaveViewer, insightsOpen]);

  function touchStart(x: number) {
    touchStartX.current = x;
  }

  function touchEnd(x: number) {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start === null) return;
    const delta = x - start;
    if (Math.abs(delta) < 55) return;
    if (delta > 0) goPrevious();
    else goNext();
  }

  useEffect(()=>{
    if(!story?.viewer.own){setInsights(null);return;}
    let live=true;
    setInsightsLoading(true);
    setInsightsError('');
    void apiFetch<StoryViewersPage>('/stories/'+encodeURIComponent(story.id)+'/viewers')
      .then(result=>{if(live)setInsights(result);})
      .catch(()=>{if(live)setInsightsError(en?'Unable to load views.':'Impossible de charger les vues.');})
      .finally(()=>{if(live)setInsightsLoading(false);});
    return()=>{live=false;};
  },[story?.id,story?.viewer.own,en]);

  const loadMoreViewers=async()=>{
    if(!story?.viewer.own||!insights?.nextCursor||insightsMoreLoading)return;
    const cursor=insights.nextCursor;
    setInsightsMoreLoading(true);
    try{
      const next=await apiFetch<StoryViewersPage>(
        '/stories/'+encodeURIComponent(story.id)+'/viewers?cursor='+encodeURIComponent(cursor));
      setInsights(current=>{
        if(!current||current.nextCursor!==cursor)return current;
        const known=new Set(current.viewers.map(viewer=>viewer.viewerUserId));
        return {...next,viewers:[...current.viewers,
          ...next.viewers.filter(person=>!known.has(person.viewerUserId))]};
      });
    }catch{setInsightsError(en?'Unable to load more viewers.':'Impossible de charger la suite.');}
    finally{setInsightsMoreLoading(false);}
  };

  const relativeViewTime=(value:string)=>{
    const diff=Math.max(0,Math.floor((Date.now()-Date.parse(value))/60000));
    if(!Number.isFinite(diff))return '';
    if(diff<1)return en?'Just now':'À l’instant';
    if(diff<60)return en?`${diff} min ago`:`Il y a ${diff} min`;
    const hours=Math.floor(diff/60);
    if(hours<24)return en?`${hours} h ago`:`Il y a ${hours} h`;
    return new Intl.DateTimeFormat(en?'en':'fr',{dateStyle:'medium'}).format(new Date(value));
  };

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
      setMessage(cause instanceof Error ? cause.message : ui.unavailable);
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
      setMessage(cause instanceof Error ? cause.message : ui.unavailable);
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
      setMessage(cause instanceof Error ? cause.message : ui.unavailable);
    }
  }

  if (sessionLoading || loading) return <main className="shell"><p>{ui.loading}</p></main>;
  if (!story) return <main className="shell"><p role="alert">{message || ui.unavailable}</p><Link href="/feed" className="btn">{ui.backFeed}</Link></main>;

  return (
    <main className="km-story-viewer">
      <section className="km-story-viewer-surface"
        onContextMenu={event=>event.preventDefault()}
        onTouchStart={(event) => touchStart(event.changedTouches[0]?.clientX ?? 0)}
        onTouchEnd={(event) => touchEnd(event.changedTouches[0]?.clientX ?? 0)}
        style={{ background: story.type === 'TEXT'
          ? (typeof story.background?.color==='string'&&/^#[0-9a-fA-F]{6}$/.test(story.background.color)
             ? story.background.color : 'linear-gradient(145deg,#6d4aff,#177f87 55%,#10131c)') : '#10131c' }}
      >
        {mediaUrl && story.type === 'PHOTO' && <img src={mediaUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#050609' }} />}
        {mediaUrl && story.type === 'VIDEO' && <video ref={videoRef} src={mediaUrl} autoPlay muted playsInline
          onTimeUpdate={event=>{
            const video=event.currentTarget;
            if(Number.isFinite(video.duration)&&video.duration>0){
              setProgress(Math.max(0,Math.min(1,video.currentTime/video.duration)));
            }
          }}
          onEnded={completeAndAdvance}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#050609' }} />}

        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', zIndex: 2, background: story.type === 'TEXT' ? 'transparent' : 'linear-gradient(rgba(0,0,0,.22), transparent 35%, rgba(0,0,0,.45))' }}>
          <div className="km-story-progress-segments" role="group"
            aria-label={en?`${segments.length} stories in this status`:`${segments.length} stories dans ce statut`}>
            {segments.map((segment,i)=><div className="km-story-progress-track" key={segment.id}>
              <div className="km-story-progress-value" style={{
                width: `${i<segmentIndex?100:i>segmentIndex?0:Math.round(progress*100)}%`
              }}/>
            </div>)}
          </div>

          <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, color: '#fff' }}>
            {story.author?.username ? (
              <Link href={`/profile/${encodeURIComponent(story.author.username)}`}
                aria-label={`Voir le profil de ${story.author.displayName}`}
                style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'inherit', textDecoration: 'none', minWidth: 0, flex: 1 }}>
                <div style={{ width: 42, height: 42, flexShrink: 0, borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,.14)', display: 'grid', placeItems: 'center', fontWeight: 800 }}>
                  {story.author.avatarUrl ? <img src={story.author.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : story.author.displayName?.[0] ?? '?'}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong style={{display:'inline-flex',alignItems:'center',gap:5}}>{story.author.displayName}<AccountBadges username={story.author.username} verification={story.author.verification} compact/></strong>
                  <div style={{ fontSize: 12, opacity: .75 }}>@{story.author.username}</div>
                </div>
              </Link>
            ) : <strong>KnowMe</strong>}
            {story.locationLabel && <small style={{ opacity: .8 }}>{story.locationLabel}</small>}
            <button type="button" className="km-story-pause" aria-label={paused?(en?'Resume story':'Reprendre la story'):(en?'Pause story':'Mettre la story en pause')}
              onClick={()=>setPlaybackPaused(!paused)}>
              {paused?<svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m7 4 14 8-14 8z"/></svg>
                :<svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>}
            </button>
            <button type="button" onClick={leaveViewer} className="km-story-viewer-close" aria-label={ui.close}>×</button>
          </header>

          <div style={{ flex: 1, position: 'relative', display: 'grid', placeItems: 'center', padding: 28, color: '#fff' }}>
            {mediaLoading && <div style={{ width: 46, height: 46, border: '3px solid rgba(255,255,255,.25)', borderTopColor: '#fff', borderRadius: '50%' }} />}

            {story.type === 'LINK' && (
              <a href={story.linkUrl ?? '#'} target="_blank" rel="noreferrer" style={{ position: 'relative', zIndex: 3, color: '#fff', width: '100%', maxWidth: 380, padding: 22, borderRadius: 22, background: 'rgba(0,0,0,.28)', textDecoration: 'none' }}>
                <strong>{ui.openLink}</strong>
                <div style={{ opacity: .8, marginTop: 8, overflowWrap: 'anywhere' }}>{story.linkUrl}</div>
              </a>
            )}

            {story.type === 'TEXT' && story.caption && (
              <p className="km-story-text-body">
                <KnowMeMentionText text={story.caption}/>
              </p>
            )}

            {story.type === 'TEXT' && story.hashtags.length > 0 && (
              <div style={{ position: 'absolute', left: 24, bottom: 70, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {story.hashtags.map((tag) => <span key={tag} style={{ padding: '5px 9px', background: 'rgba(0,0,0,.3)', borderRadius: 999, fontSize: 12 }}>#{tag}</span>)}
              </div>
            )}

            <button aria-label={en?"Previous story":"Story précédente"} disabled={!previousId} onPointerDown={startHold} onPointerUp={releaseHold} onPointerCancel={releaseHold} onClick={()=>navigateStory("previous")} style={{ position: 'absolute', inset: '0 50% 80px 0', opacity: 0, cursor: previousId ? 'pointer' : 'default' }} />
            <button aria-label={en?"Next story":"Story suivante"} onPointerDown={startHold} onPointerUp={releaseHold} onPointerCancel={releaseHold} onClick={()=>navigateStory("next")} style={{ position: 'absolute', inset: '0 0 80px 50%', opacity: 0, cursor: 'pointer' }} />
          </div>

          <footer className="km-story-viewer-footer" style={{ padding: 14, color: '#fff', background: 'rgba(2,3,7,.96)' }}>
            {story.type !== 'TEXT' && story.caption && (
              <div className="km-story-viewer-caption">
                <KnowMeMentionText text={story.caption}/>
              </div>
            )}
            {story.type !== 'TEXT' && story.hashtags.length > 0 && (
              <div className="km-story-viewer-caption-tags">
                {story.hashtags.map(tag => <span key={tag}>#{tag}</span>)}
              </div>
            )}
            {!story.viewer.own && story.allowReactions && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto' }}>
                {REACTIONS.map((reaction) => (
                  <button key={reaction} onClick={() => void react(reaction)} style={{ border: 0, borderRadius: 999, background: story.viewer.reaction?.reaction === reaction ? 'rgba(121,87,255,.9)' : 'rgba(255,255,255,.12)', color: '#fff', padding: '8px 11px', fontSize: 18 }}>{reaction}</button>
                ))}
              </div>
            )}

            {!story.viewer.own && story.allowReplies && (
              <form onSubmit={reply} style={{ display: 'flex', gap: 8 }}>
                <input name="content" className="input" maxLength={4000} onFocus={() => setPlaybackPaused(true)} onBlur={() => setPlaybackPaused(false)} placeholder={ui.reply} style={{ flex: 1, background: 'rgba(255,255,255,.09)', color: '#fff' }} />
                <button className="btn btn-primary">{ui.send}</button>
              </form>
            )}

            {story.viewer.own && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button className="km-story-owner-views" type="button" onClick={()=>{
                  setInsightsOpen(true);videoRef.current?.pause();
                }} aria-label={en?'Show story viewers':'Voir les spectateurs de la story'}>
                  <span aria-hidden="true">◉</span> {insights?.uniqueViewers??(insightsLoading?'…':'0')}
                </button>
                <button className="btn" onClick={() => void ownerAction(story.pinnedAt ? 'unpin' : 'pin')}>{story.pinnedAt ? ui.unpin : ui.pin}</button>
                <button className="btn" onClick={() => void ownerAction('archive')}>{ui.archive}</button>
                <button className="btn" onClick={() => void ownerAction('delete')}>{ui.delete}</button>
              </div>
            )}
            {story.allowSharing && (
              <button className="btn" type="button" onClick={() => {
                void navigator.clipboard.writeText(buildKnowMePublicLink({kind:'story',id:story.id}))
                  .then(() => setMessage(en ? 'Link copied' : 'Lien de la story copié'))
                  .catch(() => setMessage(en ? 'Copy unavailable' : 'Copie indisponible'));
              }}>{en ? 'Copy story link' : 'Copier le lien de la story'}</button>
            )}
            {message && <small role="alert" style={{ display: 'block', color: '#ffb095', marginTop: 8 }}>{message}</small>}
          </footer>
          {insightsOpen&&story.viewer.own&&<div className="km-story-viewers-overlay">
            <button className="km-story-viewers-scrim" aria-label={ui.close} type="button"
              onClick={()=>{setInsightsOpen(false);if(!paused)void videoRef.current?.play().catch(()=>undefined);}}/>
            <section className="km-story-viewers-sheet" role="dialog" aria-modal="true"
              aria-label={en?'Story viewers':'Spectateurs de la story'}>
              <header>
                <strong>{en?'Viewed by ':'Vu par '}{insights?.uniqueViewers??0}</strong>
                <button type="button" aria-label={ui.close}
                  onClick={()=>{setInsightsOpen(false);if(!paused)void videoRef.current?.play().catch(()=>undefined);}}>×</button>
              </header>
              {insightsError&&<p role="alert">{insightsError}</p>}
              {insightsLoading&&<p>{ui.loading}</p>}
              {!insightsLoading&&!insights?.viewers.length&&
                <p className="km-story-viewers-empty">{en?'No views yet':'Aucune vue pour le moment'}</p>}
              <ul className="km-story-viewers-list">
                {insights?.viewers.map(person=><li key={person.viewerUserId}>
                  {person.user?.username?<Link href={'/profile/'+encodeURIComponent(person.user.username)}
                    className="km-story-viewer-person">
                    {person.user.avatarUrl?<img src={person.user.avatarUrl} alt="" />:
                    <span>{person.user.displayName?.charAt(0)??'?'}</span>}
                    <span className="km-story-viewer-person-name">
                      <strong>{person.user.displayName}</strong>
                      <small>{relativeViewTime(person.lastViewedAt)}</small>
                    </span>
                    {person.reaction?.reaction&&<span className="km-story-viewer-person-reaction">
                      {reactionGlyph(person.reaction.reaction)}
                    </span>}
                  </Link>:<span>{en?'Unavailable account':'Compte indisponible'}</span>}
                </li>)}
              </ul>
              {insights?.nextCursor&&<button type="button" onClick={()=>void loadMoreViewers()}
                disabled={insightsMoreLoading} className="km-story-viewer-more">
                {insightsMoreLoading?(en?'Loading…':'Chargement…'):(en?'Show more':'Afficher plus')}
              </button>}
            </section>
          </div>}
        </div>
      </section>
    </main>
  );
}
