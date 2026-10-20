'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../lib/use-session';
import { useI18n } from '../../components/i18n-provider';
import { ReelPlayback } from './reel-playback';
import { ReelShareSheet } from './reel-share-sheet';
import { ReelFollowButton, ReelCommentSheet } from './reel-social-interactions';
import { ReelIcon } from './reel-icons';
import './reels.css';
import './reels-reference-shell.css';

type Author = { id: string; username: string; displayName: string; avatarUrl?:string|null;
  verification?:{isVerified:boolean;label:string}|null;
  staff?:{isTeamMember:boolean;shield:string;label:string}|null };
type PostMedia = {url: string;mimeType: string;position: number};
type Post = {
  id:string;content:string;createdAt:string;author:Author;
  media?:PostMedia[];
  _count:{likes:number;comments:number};
};
type Clip = {id:string;post:Post;media:PostMedia};

function mediaUrl(url: string): string {
  if (url.startsWith('/media/public/post/')) return '/api/knowme' + url;
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  if (url.startsWith('https://')) return url;
  return '';
}

export default function ReelsPage() {
  const { user, loading:sessionLoading } = useSession({required:true});
  const { locale } = useI18n();
  const en = locale === 'en';
  const [posts,setPosts]=useState<Post[]>([]);
  const [feed,setFeed]=useState<'all'|'following'>('all');
  const [searchOpen,setSearchOpen]=useState(false);
  const [query,setQuery]=useState('');
  const [commentPost,setCommentPost]=useState<Post|null>(null);
  const [commentCounts,setCommentCounts]=useState<Record<string,number>>({});
  const [loading,setLoading]=useState(true);
  const [loadingMore,setLoadingMore]=useState(false);
  const [hasMore,setHasMore]=useState(false);
  const [activeId,setActiveId]=useState<string|null>(null);
  const [feedback,setFeedback]=useState('');
  const [descriptionClip,setDescriptionClip]=useState<Clip|null>(null);
  const [sharingPost,setSharingPost]=useState<Post|null>(null);
  const resumeAfterDescription=useRef(false);
  const [error,setError]=useState('');
  const [counts,setCounts]=useState<Record<string,number>>({});
  const [liked,setLiked]=useState<Record<string,boolean>>({});
  const [pendingLike,setPendingLike]=useState<string|null>(null);
  const reelRoot=useRef<HTMLDivElement>(null);
  const requestEpoch=useRef(0);

  const clips=useMemo<Clip[]>(() => posts.flatMap(post =>
    (post.media??[]).filter(media => media.mimeType === 'video/mp4' && mediaUrl(media.url))
      .sort((a,b) => a.position-b.position)
      .map(media => ({id:post.id+':'+media.position,post,media}))
  ),[posts]);

  const load=useCallback(async(more:boolean)=>{
    if(more&&(!hasMore||loadingMore)) return;
    const epoch=++requestEpoch.current;
    more?setLoadingMore(true):setLoading(true);
    setError('');
    try{
      const cursor=more?posts[posts.length-1]?.id:undefined;
      const suffix=cursor?'?cursor='+encodeURIComponent(cursor):'';
      const endpoint=feed==='following'?'/reels/following':'/posts/videos';
      let page: Post[];
      try {
        // Use the video-only endpoint when the API has been upgraded.
        const response=await apiFetch<Post[]>(endpoint+suffix);
        if(!Array.isArray(response))throw new Error('LEGACY_REELS_RESPONSE');
        page=response;
      }catch(cause){
        const status=(cause as {status?:number})?.status;
        if(feed==='following'||status!==404 && !(cause instanceof Error && cause.message==='LEGACY_REELS_RESPONSE'))throw cause;
        // During staged Web/VPS rollouts, the old feed stays functional.
        const legacy=await apiFetch<Post[]>('/posts/feed'+suffix);
        if(!Array.isArray(legacy))throw new Error('Réponse du fil indisponible.');
        page=legacy;
      }
      if(epoch!==requestEpoch.current)return;
      setPosts(current=>{
        if(!more) return page;
        const known=new Set(current.map(post=>post.id));
        return [...current,...page.filter(post=>!known.has(post.id))];
      });
      setHasMore(page.length===20);
      const ids=[...new Set(page.map(post=>post.id))].slice(0,30);
      if(ids.length)void apiFetch<{likedPostIds:string[]}>(
        '/reels/likes?ids='+ids.map(encodeURIComponent).join(',')
      ).then(snapshot=>{
        if(epoch!==requestEpoch.current||!Array.isArray(snapshot.likedPostIds))return;
        const set=new Set(snapshot.likedPostIds);
        setLiked(prev=>{
          const next={...prev};
          for(const post of page)next[post.id]=set.has(post.id);
          return next;
        });
      }).catch(()=>undefined);
    }catch(cause){
      if(epoch===requestEpoch.current)
        setError(cause instanceof Error?cause.message:(en?'Videos unavailable.':'Vidéos indisponibles.'));
    }finally{
      if(epoch===requestEpoch.current){setLoading(false);setLoadingMore(false);}
    }
  },[en,hasMore,loadingMore,posts,feed]);

  // Start an isolated server feed on each tab; don't reuse the public cursor.
  useEffect(()=>{
    if(sessionLoading||!user)return;
    setActiveId(null);
    setPosts([]);
    void load(false);
    return()=>{requestEpoch.current++;};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[sessionLoading,user?.id,feed]);

  const visibleClips=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase();
    return q?clips.filter(clip=>(clip.post.content+' '+clip.post.author.username)
      .toLocaleLowerCase().includes(q)):clips;
  },[clips,query]);
  useEffect(()=>{
    if(!activeId&&visibleClips[0])setActiveId(visibleClips[0].id);
  },[activeId,visibleClips]);

  useEffect(()=>{
    const root=reelRoot.current;
    if(!root||!visibleClips.length||typeof IntersectionObserver==='undefined')return;
    const observer=new IntersectionObserver(entries=>{
      const visible=entries.filter(entry=>entry.isIntersecting&&entry.intersectionRatio>=0.55)
        .sort((a,b)=>b.intersectionRatio-a.intersectionRatio);
      if(visible[0]){
        const id=(visible[0].target as HTMLElement).dataset.videoId;
        if(id)setActiveId(id);
      }
    },{root,threshold:[0.55,0.7,0.95]});
    for(const card of root.querySelectorAll<HTMLElement>('[data-video-id]'))
      observer.observe(card);
    return ()=>observer.disconnect();
  },[visibleClips]);

  function openDescription(clip:Clip){
    const video=reelRoot.current?.querySelector<HTMLVideoElement>('video');
    resumeAfterDescription.current=Boolean(video&&!video.paused);
    video?.pause();
    setDescriptionClip(clip);
  }
  function closeDescription(){
    setDescriptionClip(null);
    if(resumeAfterDescription.current&&!document.hidden){
      void reelRoot.current?.querySelector<HTMLVideoElement>('video')
        ?.play().catch(()=>undefined);
    }
    resumeAfterDescription.current=false;
  }
  useEffect(()=>{
    if(!descriptionClip)return;
    const keyDown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();closeDescription();}
    };
    document.addEventListener('keydown',keyDown);
    return()=>document.removeEventListener('keydown',keyDown);
  },[descriptionClip]);

  function go(delta:number){
    const index=visibleClips.findIndex(clip=>clip.id===activeId);
    const next=visibleClips[Math.min(visibleClips.length-1,Math.max(0,(index<0?0:index)+delta))];
    if(!next)return;
    setActiveId(next.id);
    reelRoot.current?.querySelectorAll<HTMLElement>('[data-video-id]')[visibleClips.indexOf(next)]
      ?.scrollIntoView({block:'center',behavior:'smooth'});
  }

  async function ensureLike(post:Post){
    if(pendingLike || liked[post.id] === true)return;
    setPendingLike(post.id);
    try {
      const result=await apiFetch<{liked:boolean;count:number}>(
        '/posts/'+encodeURIComponent(post.id)+'/like',{method:'PUT'}
      );
      setLiked(current=>({...current,[post.id]:result.liked}));
      // Use the server total, since the post might have been liked earlier
      // on another device; guessing +1 would overcount.
      setCounts(current=>({...current,[post.id]:result.count}));
    } catch(cause) {
      setFeedback(cause instanceof Error?cause.message:
        (en?'Reaction unavailable.':'Réaction impossible.'));
    } finally {
      setPendingLike(null);
    }
  }

  async function like(post:Post){
    if(pendingLike)return;
    setPendingLike(post.id);
    try{
      const res=await apiFetch<{liked:boolean}>('/posts/'+encodeURIComponent(post.id)+'/like',{method:'POST'});
      const had=liked[post.id];
      setLiked(current=>({...current,[post.id]:res.liked}));
      setCounts(current=>{
        const prior=current[post.id]??post._count.likes;
        const next=had===res.liked ? prior
          : res.liked ? prior+1 : Math.max(0,prior-1);
        return {...current,[post.id]:next};
      });
    }catch(cause){
      setFeedback(cause instanceof Error?cause.message:(en?'Reaction unavailable.':'Réaction impossible.'));
    }finally{setPendingLike(null);}
  }

  if(sessionLoading||!user)return <main className="km-reels-page"><p>Chargement…</p></main>;
  return (
    <main className="km-reels-page" aria-label={en?'KnowMe videos':'Vidéos KnowMe'}>
      <header className="km-reels-header">
        <Link href="/feed" aria-label={en?'Back to feed':'Retour au fil'}
          className="km-reel-header-icon"><ReelIcon name="back" size={28}/></Link>
        <strong className="km-reel-header-title">KnowMe · Reels</strong>
        <div className="km-reel-header-actions">
          <button type="button" className="km-reel-header-icon"
            aria-expanded={searchOpen}
            aria-label={en?'Search loaded Reels':'Rechercher parmi les Réels chargés'}
            onClick={()=>setSearchOpen(value=>!value)}><ReelIcon name="search" size={28}/></button>
          <Link href={'/profile/'+encodeURIComponent(user.username)}
            className="km-reel-header-icon" aria-label={en?'My profile':'Mon profil'}>
            <ReelIcon name="profile" size={29}/>
          </Link>
        </div>
      </header>
      <div className="km-reels-top-tabs" role="tablist"
        aria-label={en?'Reels feed':'Fil Reels'}>
        <button type="button" role="tab" aria-selected={feed==='all'}
          className={feed==='all'?'km-reel-tab-active':''}
          onClick={()=>{if(feed!=='all'){setQuery('');setActiveId(null);setPosts([]);setFeed('all');}}}>
          {en?'For you':'Pour toi'}
        </button>
        <button type="button" role="tab" aria-selected={feed==='following'}
          className={feed==='following'?'km-reel-tab-active':''}
          onClick={()=>{if(feed!=='following'){setQuery('');setActiveId(null);setPosts([]);setFeed('following');}}}>
          {en?'Following':'Abonnements'}
        </button>
      </div>
      {searchOpen&&<div className="km-reel-search-field">
        <ReelIcon name="search" size={20}/>
        <input value={query} onChange={event=>setQuery(event.currentTarget.value)}
          aria-label={en?'Search loaded videos':'Rechercher parmi les vidéos chargées'}
          placeholder={en?'Search loaded videos':'Rechercher parmi les vidéos chargées'}/>
        <button type="button" onClick={()=>{setQuery('');setSearchOpen(false);}}
          aria-label={en?'Close search':'Fermer la recherche'}>×</button>
      </div>}
      {feedback&&<div role="status" className="km-reels-notice"
        onClick={()=>setFeedback('')}>{feedback}</div>}
      <div className="km-reels-viewport" ref={reelRoot}
        role="region" aria-label={en?'Vertical video feed':'Fil vertical des vidéos'}
        tabIndex={0} onKeyDown={event=>{
          if(event.target!==event.currentTarget)return;
          if(event.key==='ArrowDown'){event.preventDefault();go(1);}
          if(event.key==='ArrowUp'){event.preventDefault();go(-1);}
        }}>
        {loading&&<p className="km-reels-empty">{en?'Loading videos…':'Chargement des vidéos…'}</p>}
        {!loading&&!visibleClips.length&&
          <div className="km-reels-empty">
            <h2>{query.trim()?(en?'No matching loaded videos':'Aucune vidéo chargée correspondante')
              :feed==='following'?(en?'No videos from followed creators':'Aucune vidéo de tes abonnements')
              :(en?'No videos on your feed yet':'Aucune vidéo dans ton fil pour le moment')}</h2>
            <p>{en?'Explore or publish a video from KnowMe.':'Découvre des publications ou publie une vidéo sur KnowMe.'}</p>
            <Link href="/feed">{en?'Return to feed':'Retour au fil'}</Link>
          </div>}
        {visibleClips.map(clip=>{
          const active=clip.id===activeId;
          const post=clip.post;
          return <section className="km-reel-frame" data-video-id={clip.id}
            key={clip.id} aria-label={en?'Video from '+post.author.displayName:'Vidéo de '+post.author.displayName}>
            {active ? <ReelPlayback key={clip.id} src={mediaUrl(clip.media.url)}
              en={en} pausedExternally={Boolean(sharingPost)||Boolean(commentPost)}
              onDoubleTap={() => { void ensureLike(post); }} />
            : <div className="km-reel-placeholder" aria-hidden="true"><span>▶</span></div>}
            <div className="km-reel-overlay">
              <div className="km-reel-info">
                <div className="km-reel-creator">
                  <Link href={'/profile/'+encodeURIComponent(post.author.username)}
                    className="km-reel-avatar" aria-label={en?'Creator profile':'Profil du créateur'}>
                    {post.author.avatarUrl&&mediaUrl(post.author.avatarUrl)?
                      <img alt="" src={mediaUrl(post.author.avatarUrl)}/>:
                      <span>{post.author.displayName.slice(0,1).toUpperCase()}</span>}
                  </Link>
                  <Link href={'/profile/'+encodeURIComponent(post.author.username)}>
                    @{post.author.username}
                  </Link>
                  {post.author.verification?.isVerified&&
                    <span className="km-reel-certified" title={post.author.verification.label}>✓</span>}
                  {post.author.staff?.shield==='GOLD'&&
                    <span className="km-reel-certified km-reel-certified-gold" title={post.author.staff.label}>✓</span>}
                  <ReelFollowButton authorId={post.author.id} username={post.author.username}
                    viewerId={user.id} en={en}/>
                </div>
                {post.content&&<>
                  <p>{post.content}</p>
                  <button className="km-reel-read-description" type="button"
                    onClick={()=>openDescription(clip)}
                    aria-label={en?'Read the complete video description':'Lire toute la description du Reel'}>
                    {en?'Read full description':'Voir toute la description'}
                  </button>
                </>}
                <Link href={'/feed/'+encodeURIComponent(post.id)}>
                  {en?'View publication':'Voir la publication'}
                </Link>
                {Boolean(post.content.match(/#[\p{L}\p{N}_]+/gu)?.length)&&
                  <div className="km-reel-hashtags">
                    {[...new Set(post.content.match(/#[\p{L}\p{N}_]+/gu)??[])].slice(0,5).map(tag=>
                      <button key={tag} type="button" onClick={()=>{
                        setQuery(tag);setSearchOpen(true);
                      }}>{tag}</button>)}
                  </div>}
              </div>
              <div className="km-reel-actions">
                <button type="button" disabled={pendingLike===post.id}
                  aria-pressed={Boolean(liked[post.id])}
                  onClick={()=>void like(post)} aria-label={en?'React to publication':'Réagir à la publication'}>
                  <ReelIcon name="heart" filled={liked[post.id]} size={34}/>
                  {counts[post.id]??post._count.likes}
                </button>
                <Link href={'/feed/'+encodeURIComponent(post.id)+'#km-post-comments'}
                  aria-label={en?'Open comments':'Ouvrir les commentaires'}>
                  <ReelIcon name="comment" size={32}/>{commentCounts[post.id]??post._count.comments}
                </Link>
                <button type="button" onClick={()=>setSharingPost(post)}
                  aria-label={en?'Share video':'Partager la vidéo'}>
                  <ReelIcon name="share" size={32}/>
                </button>
              </div>
            </div>
            <button type="button" className="km-reel-compose"
              onClick={()=>setCommentPost(post)}
              aria-label={en?'Add a comment':'Ajouter un commentaire'}>
              <span className="km-reel-compose-avatar">{user.displayName?.slice(0,1)?.toUpperCase()||'K'}</span>
              <span className="km-reel-compose-placeholder">{en?'Add a comment…':'Ajouter un commentaire…'}</span>
              <strong>@</strong><ReelIcon name="smile" size={24}/>
            </button>
          </section>;
        })}
        {!loading&&hasMore&&
          <div className="km-reels-pagination">
            <button type="button" disabled={loadingMore} onClick={()=>void load(true)}>
              {loadingMore?(en?'Loading…':'Chargement…'):(en?'Load more videos':'Charger d’autres vidéos')}
            </button>
          </div>}
        {error&&<p role="alert" className="km-reels-error">{error}</p>}
      </div>
      {descriptionClip&&<div className="km-reel-caption-backdrop"
        role="presentation"
        onMouseDown={event=>{
          if(event.target===event.currentTarget)closeDescription();
        }}>
        <section className="km-reel-caption-dialog" role="dialog" aria-modal="true"
          aria-label={en?'Full Reel description':'Description complète du Reel'}>
          <div className="km-reel-caption-top">
            <h2>{en?'Video description':'Description du Reel'}</h2>
            <button type="button" autoFocus onClick={closeDescription}
              aria-label={en?'Close description':'Fermer la description'}>×</button>
          </div>
          <Link href={'/profile/'+encodeURIComponent(descriptionClip.post.author.username)}
            onClick={closeDescription} className="km-reel-caption-author">
            @{descriptionClip.post.author.username}
          </Link>
          <div className="km-reel-caption-body">
            <p>{descriptionClip.post.content}</p>
          </div>
          <small>{en?'Text can be selected and copied.':'Le texte peut être sélectionné et copié.'}</small>
        </section>
      </div>}
      {commentPost&&<ReelCommentSheet key={commentPost.id} postId={commentPost.id}
        en={en} onClose={()=>setCommentPost(null)}
        onSent={()=>{
          const post=commentPost;
          setCommentCounts(current=>({...current,
            [post.id]:(current[post.id]??post._count.comments)+1
          }));
          setCommentPost(null);
        }}
        onViewAll={()=>{
          const id=commentPost.id;
          setCommentPost(null);
          window.location.assign('/feed/'+encodeURIComponent(id)+'#km-post-comments');
        }}/>}
      {sharingPost&&<ReelShareSheet post={sharingPost} viewerId={user.id} en={en}
        onClose={()=>setSharingPost(null)}
        onHide={()=>{
          const id=sharingPost.id;
          setSharingPost(null);
          setPosts(current=>current.filter(post=>post.id!==id));
          setActiveId(null);
          reelRoot.current?.scrollTo({top:0,behavior:'auto'});
        }}/>} 
      {!!visibleClips.length&&<div className="km-reels-steps">
        <button type="button" onClick={()=>go(-1)} disabled={activeId===visibleClips[0]?.id}
          aria-label={en?'Previous video':'Vidéo précédente'}>↑</button>
        <button type="button" onClick={()=>go(1)} disabled={activeId===visibleClips[visibleClips.length-1]?.id}
          aria-label={en?'Next video':'Vidéo suivante'}>↓</button>
      </div>}
    </main>
  );
}
