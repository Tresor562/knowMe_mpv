'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccountBadges } from '../../../../components/AccountBadges';
import { useI18n } from '../../../../components/i18n-provider';
import { apiFetch } from '../../../../lib/api';
import { useSession } from '../../../../lib/use-session';
import { storyUi } from '../../story-i18n';
import './story-viewers.css';

type Viewer = {
  viewerUserId: string;
  lastViewedAt: string;
  viewCount: number;
  completionBps: number;
  screenshotAt?: string | null;
  user: {
    username: string;
    displayName: string;
    avatarUrl?: string | null;
    verification?: import('../../../../lib/use-session').VerificationBadge | null;
  } | null;
};
type Analytics = {
  uniqueViewers: number;
  totalViews: number;
  replies: number;
  reactions: number;
  averageCompletionBps: number;
  screenshots: number;
  viewers: Viewer[];
};
type Filter = 'all' | 'completed' | 'screenshots';
type Sort = 'recent' | 'frequent';

const translations = {
  fr: {
    title:'Spectateurs', subtitle:'Statistiques de ta story', back:'Retour à la Story', refresh:'Actualiser',
    search:'Rechercher un spectateur', placeholder:'Nom ou @pseudo', all:'Tous',
    completed:'Terminées', screenshots:'Captures', recent:'Plus récentes', frequent:'Plus de vues',
    shown:'spectateurs affichés', none:'Aucun résultat pour cette recherche.',
    missing:'Profil indisponible', single:'vue', plural:'vues', screenshot:'Capture signalée',
    limited:'Seuls les 500 derniers spectateurs sont affichés. Les statistiques peuvent être partielles.',
    loading:'Chargement des spectateurs…', error:'Impossible de charger les spectateurs.',
    retry:'Réessayer', cached:'Les derniers résultats restent affichés.',
    average:'Progression moyenne', progress:'Progression de visionnage', empty:'Personne n’a encore vu cette story.'
  },
  en: {
    title:'Viewers', subtitle:'Your story insights', back:'Back to Story', refresh:'Refresh',
    search:'Search viewers', placeholder:'Name or @username', all:'All',
    completed:'Completed', screenshots:'Screenshots', recent:'Most recent', frequent:'Most views',
    shown:'viewers shown', none:'No results match this search.',
    missing:'Profile unavailable', single:'view', plural:'views', screenshot:'Screenshot reported',
    limited:'Only the latest 500 viewers are shown. Statistics may be incomplete.',
    loading:'Loading viewers…', error:'Unable to load viewers.',
    retry:'Retry', cached:'Showing the last available results.',
    average:'Average completion', progress:'Watch progress', empty:'No one has viewed this Story yet.'
  }
} as const;

const percent = (bps:number) => Number.isFinite(bps) ? Math.max(0,Math.min(100,Math.round(bps/100))) : 0;
const count = (n:number) => Number.isFinite(n) ? Math.max(0,n) : 0;

export default function StoryViewersPage() {
  const { id } = useParams<{id:string}>();
  const { locale } = useI18n();
  const en = locale === 'en';
  const t = translations[en ? 'en' : 'fr'];
  const ui = storyUi(en ? 'en' : 'fr');
  const {user, loading:sessionLoading} = useSession({required:true});
  const [analytics,setAnalytics] = useState<Analytics|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [search,setSearch] = useState('');
  const [filter,setFilter] = useState<Filter>('all');
  const [sort,setSort] = useState<Sort>('recent');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch<Analytics>('/stories/'+encodeURIComponent(id)+'/viewers');
      if (!Array.isArray(result.viewers)) throw new Error('Invalid Story viewer response.');
      setAnalytics(result);
    } catch {
      // Preserve an already visible list on intermittent network errors.
      setError('STORY_INSIGHTS_UNAVAILABLE');
    } finally {
      setLoading(false);
    }
  },[id]);

  useEffect(()=>{if (!sessionLoading && user) void load();},[load,sessionLoading,user?.id]);

  // Search and sort only the returned page: the API currently caps it at 500 viewers.
  const visible = useMemo(()=>{
    if (!analytics) return [];
    const needle = search.trim().replace(/^@/,'').toLocaleLowerCase(en?'en':'fr');
    return analytics.viewers.filter(entry=>{
      if (filter==='completed' && percent(entry.completionBps)!==100) return false;
      if (filter==='screenshots' && !entry.screenshotAt) return false;
      return !needle || (entry.user?.displayName??'').toLocaleLowerCase(en?'en':'fr').includes(needle) ||
        (entry.user?.username??'').toLocaleLowerCase(en?'en':'fr').includes(needle);
    }).sort((a,b)=>{
      const date=Date.parse(b.lastViewedAt)-Date.parse(a.lastViewedAt);
      return sort==='frequent'?count(b.viewCount)-count(a.viewCount)||date:date;
    });
  },[analytics,search,filter,sort,en]);

  const dateLabel=(value:string)=>{
    const date=new Date(value);
    return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat(en?'en':'fr',{
      dateStyle:'medium',timeStyle:'short'
    }).format(date);
  };

  return <main className="shell km-story-insights">
    <header className="km-story-insights-header">
      <Link href={'/stories/'+encodeURIComponent(id)}
        className="km-story-insights-back" aria-label={t.back} title={t.back}>←</Link>
      <div className="km-story-insights-heading">
        <small>{t.subtitle}</small><h1>{t.title}</h1>
      </div>
      <button type="button" className="km-story-insights-refresh"
        onClick={()=>void load()} disabled={loading||sessionLoading||!user}>{t.refresh}</button>
    </header>

    {error && <div className="km-story-insights-error" role="alert">
      <p>{t.error}</p>{analytics&&<small>{t.cached}</small>}
      <button type="button" onClick={()=>void load()} disabled={loading}>{t.retry}</button>
    </div>}
    {(sessionLoading||(loading&&!analytics))&&<p role="status" className="km-story-insights-empty">{t.loading}</p>}

    {analytics && <>
      <section className="km-story-insights-summary" aria-label={ui.insights}>
        <dl className="km-story-insights-stats">
          <Metric name={ui.uniqueViewers} value={analytics.uniqueViewers}/>
          <Metric name={ui.totalViews} value={analytics.totalViews}/>
          <Metric name={ui.reactions} value={analytics.reactions}/>
          <Metric name={ui.replies} value={analytics.replies}/>
          <Metric name={ui.screenshots} value={analytics.screenshots}/>
        </dl>
        <div className="km-story-insights-completion">
          <div><span>{t.average}</span><strong>{percent(analytics.averageCompletionBps)}%</strong></div>
          <div role="progressbar" className="km-story-insights-bar"
            aria-label={t.average} aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={percent(analytics.averageCompletionBps)}>
            <span style={{width:percent(analytics.averageCompletionBps)+'%'}}/>
          </div>
        </div>
      </section>

      <section className="km-story-insights-list" aria-label={ui.viewers}>
        <div className="km-story-insights-list-heading">
          <h2>{ui.viewers}</h2><span>{visible.length} {t.shown}</span>
        </div>
        {analytics.viewers.length>0&&<>
          <div className="km-story-insights-controls">
            <input type="search" value={search} onChange={event=>setSearch(event.target.value)}
              aria-label={t.search} placeholder={t.placeholder} className="km-story-insights-search"/>
            <div role="group" aria-label={ui.viewers} className="km-story-insights-filters">
              {(['all','completed','screenshots'] as Filter[]).map(value=>
                <button type="button" key={value} aria-pressed={filter===value}
                  className={filter===value?'selected':''} onClick={()=>setFilter(value)}>{t[value]}</button>
              )}
            </div>
            <div role="group" aria-label={t.recent} className="km-story-insights-sort">
              {(['recent','frequent'] as Sort[]).map(value=>
                <button type="button" key={value} aria-pressed={sort===value}
                  className={sort===value?'selected':''} onClick={()=>setSort(value)}>{t[value]}</button>
              )}
            </div>
          </div>
          {analytics.viewers.length>=500&&<p className="km-story-insights-limit" role="note">{t.limited}</p>}
        </>}
        {analytics.viewers.length===0&&<p className="km-story-insights-empty">{t.empty}</p>}
        {analytics.viewers.length>0&&visible.length===0&&<p className="km-story-insights-empty">{t.none}</p>}
        <ul className="km-story-insights-viewers">
          {visible.map(entry=><li key={entry.viewerUserId} className="km-story-insights-person">
            {entry.user?.username?
              <Link className="km-story-insights-person-link"
                href={'/profile/'+encodeURIComponent(entry.user.username)}>
                <Avatar entry={entry}/>
                <span className="km-story-insights-identity">
                  <strong>{entry.user.displayName}
                    <AccountBadges username={entry.user.username} verification={entry.user.verification} compact/>
                  </strong>
                  <span>@{entry.user.username}</span>
                </span>
              </Link>:
              <div className="km-story-insights-person-link">
                <Avatar entry={entry}/><span className="km-story-insights-identity"><strong>{t.missing}</strong></span>
              </div>
            }
            <div className="km-story-insights-person-details">
              <time dateTime={entry.lastViewedAt}>{dateLabel(entry.lastViewedAt)}</time>
              <span>{count(entry.viewCount)} {entry.viewCount===1?t.single:t.plural}</span>
              <div className="km-story-insights-view-progress">
                <div role="progressbar" aria-label={t.progress} aria-valuemin={0} aria-valuemax={100}
                  aria-valuenow={percent(entry.completionBps)}>
                  <span style={{width:percent(entry.completionBps)+'%'}}/>
                </div>
                <span>{percent(entry.completionBps)}%</span>
              </div>
              {entry.screenshotAt&&<span className="km-story-insights-screenshot">{t.screenshot}</span>}
            </div>
          </li>)}
        </ul>
      </section>
    </>}
  </main>;
}

function Metric({name,value}:{name:string;value:number}){
  return <div className="km-story-insights-stat"><dt>{name}</dt><dd>{count(value)}</dd></div>;
}
function Avatar({entry}:{entry:Viewer}){
  const name=entry.user?.displayName??'';
  return <span className="km-story-insights-avatar" aria-hidden="true">
    {entry.user?.avatarUrl?<img src={entry.user.avatarUrl} alt="" loading="lazy"/>:name.trim().charAt(0).toLocaleUpperCase()||'?'}
  </span>;
}
