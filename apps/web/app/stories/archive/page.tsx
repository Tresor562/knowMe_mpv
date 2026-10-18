'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../components/i18n-provider';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';
import { storyUi } from '../story-i18n';
import './story-archive.css';

type Story = {
  id: string;
  type: string;
  caption?: string | null;
  createdAt: string;
  archivedAt?: string | null;
  pinnedAt?: string | null;
  hashtags?: string[];
};
type ArchiveResponse = { stories: Story[]; nextCursor: string | null };
type Filter = 'all' | 'pinned' | 'text' | 'photo' | 'video';

const labels = {
  fr: {
    title:'Archive des Stories', subtitle:'Tes Stories expirées ou archivées',
    back:'Retour à la création', refresh:'Actualiser', empty:'Aucune Story archivée pour le moment.',
    emptyFiltered:'Aucune Story ne correspond à ce filtre.',
    all:'Toutes', pinned:'Épinglées', text:'Textes', photo:'Photos', video:'Vidéos',
    open:'Ouvrir la Story', insights:'Spectateurs et statistiques', next:'Afficher plus de Stories', loading:'Chargement de ton archive…',
    more:'Chargement des Stories suivantes…', error:'Impossible de charger ton archive.',
    moreError:'Impossible de charger la suite des Stories.',
    retry:'Réessayer', cached:'Les Stories déjà chargées restent disponibles.',
    created:'Publiée le', archived:'Archivée le', pinnedMark:'Épinglée', fallback:'Story sans description',
    results:'Stories affichées', partial:'Le filtre porte sur les Stories déjà chargées. Affiche la suite pour tout voir.'
  },
  en: {
    title:'Story archive', subtitle:'Your expired or archived Stories',
    back:'Back to Story creation', refresh:'Refresh', empty:'No archived Stories yet.',
    emptyFiltered:'No Stories match this filter.',
    all:'All', pinned:'Pinned', text:'Text', photo:'Photos', video:'Videos',
    open:'Open Story', insights:'Viewers and insights', next:'Load more Stories', loading:'Loading your archive…',
    more:'Loading more Stories…', error:'Unable to load your archive.',
    moreError:'Unable to load more Stories.',
    retry:'Retry', cached:'Previously loaded Stories are still available.',
    created:'Published on', archived:'Archived on', pinnedMark:'Pinned', fallback:'Story without description',
    results:'Stories shown', partial:'This filter applies to loaded Stories only. Load more to see the full archive.'
  }
} as const;

export default function StoryArchivePage() {
  const { locale } = useI18n();
  const en = locale === 'en';
  const t = labels[en ? 'en' : 'fr'];
  const ui = storyUi(en ? 'en' : 'fr');
  const { user, loading:sessionLoading } = useSession({required:true});
  const [stories,setStories] = useState<Story[]>([]);
  const [nextCursor,setNextCursor] = useState<string|null>(null);
  const [loading,setLoading] = useState(true);
  const [loadingMore,setLoadingMore] = useState(false);
  const [error,setError] = useState(false);
  const [moreError,setMoreError] = useState(false);
  const [filter,setFilter] = useState<Filter>('all');
  const loadingPage = useRef(false);

  const load = useCallback(async () => {
    if (loadingPage.current) return;
    loadingPage.current = true;
    setLoading(true);setError(false);setMoreError(false);
    try {
      const page=await apiFetch<ArchiveResponse>('/stories/me/archive');
      if (!Array.isArray(page.stories)) throw new Error('Invalid Story archive response');
      setStories(page.stories);
      setNextCursor(page.nextCursor ?? null);
    } catch {
      // Retain the last successful page for intermittent network failures.
      setError(true);
    } finally {
      loadingPage.current=false;setLoading(false);
    }
  },[]);

  useEffect(()=>{if (!sessionLoading && user) void load();},[load,sessionLoading,user?.id]);

  const loadMore=async()=>{
    if (!nextCursor||loadingPage.current) return;
    loadingPage.current=true;setLoadingMore(true);setMoreError(false);
    const cursor=nextCursor;
    try {
      const page=await apiFetch<ArchiveResponse>(
        '/stories/me/archive?cursor='+encodeURIComponent(cursor)
      );
      if (!Array.isArray(page.stories)) throw new Error('Invalid Story archive page');
      setStories(current=>{
        const known=new Set(current.map(story=>story.id));
        return [...current,...page.stories.filter(story=>!known.has(story.id))];
      });
      // A broken cursor contract must not create an infinite pagination loop.
      setNextCursor(page.nextCursor && page.nextCursor!==cursor?page.nextCursor:null);
    } catch {
      setMoreError(true);
    } finally {
      loadingPage.current=false;setLoadingMore(false);
    }
  };

  const visible=stories.filter(story=>{
    if (filter==='pinned') return Boolean(story.pinnedAt);
    if (filter==='all') return true;
    return story.type.toLowerCase()===filter;
  });

  const format=(value?:string|null)=>{
    if(!value)return '';
    const date=new Date(value);
    return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat(en?'en':'fr',{
      dateStyle:'medium',timeStyle:'short'
    }).format(date);
  };

  return <main className="shell km-story-archive">
    <header className="km-story-archive-header">
      <Link href="/stories/new" className="km-story-archive-back"
        aria-label={t.back} title={t.back}>←</Link>
      <div className="km-story-archive-title">
        <small>@{user?.username ?? 'KnowMe'} · {t.subtitle}</small>
        <h1>{t.title}</h1>
      </div>
      <button type="button" onClick={()=>void load()}
        disabled={sessionLoading||loading||loadingMore||!user}>{t.refresh}</button>
    </header>

    {error&&<div className="km-story-archive-error" role="alert">
      <span>{t.error} {stories.length>0&&t.cached}</span>
      <button type="button" onClick={()=>void load()} disabled={loading}>{t.retry}</button>
    </div>}
    {(sessionLoading||(loading&&stories.length===0))&&
      <p role="status" className="km-story-archive-status">{t.loading}</p>}

    {(stories.length>0 || (!loading&&!error)) && <>
      {stories.length>0&&<div className="km-story-archive-filters" role="group" aria-label={t.title}>
        {(['all','pinned','text','photo','video'] as Filter[]).map(value=>
          <button type="button" key={value} aria-pressed={filter===value}
            onClick={()=>setFilter(value)} className={filter===value?'selected':''}>{t[value]}</button>
        )}
      </div>}
      {stories.length>0&&<div className="km-story-archive-count">
        <span>{visible.length} {t.results}</span>
        {nextCursor&&<small>{t.partial}</small>}
      </div>}
      {stories.length===0&&<p className="km-story-archive-status">{t.empty}</p>}
      {stories.length>0&&visible.length===0&&
        <p className="km-story-archive-status">{t.emptyFiltered}</p>}
      <ul className="km-story-archive-grid">
        {visible.map(story=>
          <li key={story.id}>
            <Link className="km-story-archive-entry" href={'/stories/'+encodeURIComponent(story.id)}
              aria-label={t.open+' · '+(story.caption?.trim()||t.fallback)}>
              <div className="km-story-archive-preview">
                <span className="km-story-archive-type">{story.type==='TEXT'?t.text:story.type==='PHOTO'?t.photo:story.type==='VIDEO'?t.video:story.type}</span>
                {story.pinnedAt&&<span className="km-story-archive-pinned">{t.pinnedMark}</span>}
                <p>{story.caption?.trim()||t.fallback}</p>
              </div>
              <div className="km-story-archive-meta">
                <time dateTime={story.createdAt}>{t.created} {format(story.createdAt)}</time>
                {story.archivedAt&&<time dateTime={story.archivedAt}>{t.archived} {format(story.archivedAt)}</time>}
              </div>
            </Link>
            <Link className="km-story-archive-insights"
              href={'/stories/'+encodeURIComponent(story.id)+'/insights'}
              aria-label={t.insights+' · '+(story.caption?.trim()||t.fallback)}>
              {t.insights} <span aria-hidden="true">→</span>
            </Link>
          </li>
        )}
      </ul>
      {nextCursor&&<div className="km-story-archive-more">
        {moreError&&<p role="alert">{t.moreError}</p>}
        <button type="button" disabled={loadingMore} onClick={()=>void loadMore()}>
          {loadingMore?t.more:moreError?t.retry:t.next}
        </button>
      </div>}
    </>}
  </main>;
}
