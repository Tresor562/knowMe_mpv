'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, apiFetchBlob } from '../../../lib/api';
import { ChatMediaView } from './ChatMediaView';
import { messageSelectionLinks } from './shared-content-selection';
import {
  appendSharedMessages, filterSharedHistory, sharedAuthorOptions, linksInMessage,
  type SharedMediaFilter, type SharedHistorySort,
  type SharedContentKind, type SharedMessage
} from './group-shared-content-model';
import './group-shared-content.css';

type History = { items: SharedMessage[]; nextCursor?: string | null };

const TITLES: Record<SharedContentKind, {fr: string; en: string}> = {
  media: {fr:'Médias partagés',en:'Shared media'},
  files: {fr:'Fichiers partagés',en:'Shared files'},
  links: {fr:'Liens partagés',en:'Shared links'},
  search: {fr:'Rechercher des messages',en:'Search messages'}
};

export function GroupSharedContent({
  conversationId, kind, en, isGroup = true
}: {conversationId: string; kind: SharedContentKind; en: boolean; isGroup?: boolean}) {
  const [messages,setMessages] = useState<SharedMessage[]>([]);
  const [cursor,setCursor] = useState<string|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [search,setSearch] = useState('');
  const [selecting,setSelecting] = useState(false);
  const [selectedIds,setSelectedIds] = useState<string[]>([]);
  const [selectionFeedback,setSelectionFeedback] = useState('');
  const [subtype,setSubtype] = useState<SharedMediaFilter>('ALL');
  const [author,setAuthor] = useState('');
  const [fromDate,setFromDate] = useState('');
  const [toDate,setToDate] = useState('');
  const [sort,setSort] = useState<SharedHistorySort>('newest');
  const [downloading,setDownloading] = useState<string|null>(null);
  const [downloadError,setDownloadError] = useState('');
  const [initialLoaded,setInitialLoaded] = useState(false);
  const requestSequence=useRef(0);

  const load = useCallback(async (next?: string | null) => {
    const request=++requestSequence.current;
    setLoading(true); setError('');
    try {
      const query = new URLSearchParams({limit:'30'});
      if (next) query.set('cursor',next);
      const response = await apiFetch<History>(
        `/conversations/${encodeURIComponent(conversationId)}/messages?${query.toString()}`
      );
      if(request!==requestSequence.current)return;
      const received = Array.isArray(response.items) ? response.items : [];
      setMessages(previous => next ? appendSharedMessages(previous,received) : received);
      // A server cursor means there is more history, even when this page has
      // no media of the selected category. Never claim the whole chat is empty.
      setCursor(typeof response.nextCursor==='string' ? response.nextCursor : null);
      setInitialLoaded(true);
    } catch(cause) {
      if(request!==requestSequence.current)return;
      setError(cause instanceof Error ? cause.message :
        en?'Unable to load shared content.':'Impossible de charger les contenus.');
    } finally {if(request===requestSequence.current)setLoading(false);}
  },[conversationId,en]);

  useEffect(()=>{
    setMessages([]);setCursor(null);setInitialLoaded(false);
    void load();
    return ()=>{requestSequence.current++;};
  },[load]);

  const filterOptions: Array<{value:SharedMediaFilter; fr:string; en:string}> =
    kind==='media' ? [
      {value:'ALL',fr:'Tout',en:'All'},
      {value:'IMAGE',fr:'Photos',en:'Photos'},
      {value:'VIDEO',fr:'Vidéos',en:'Videos'},
      {value:'GIF',fr:'GIF',en:'GIF'},
      {value:'STICKER_IMAGE',fr:'Stickers',en:'Stickers'}
    ]:kind==='files'?[
      {value:'ALL',fr:'Tout',en:'All'},
      {value:'DOCUMENT',fr:'Documents',en:'Documents'},
      {value:'AUDIO',fr:'Audios',en:'Audios'}
    ]:[];
  const effectiveSubtype=filterOptions.some(option=>option.value===subtype)?subtype:'ALL';
  const authors=useMemo(()=>sharedAuthorOptions(messages),[messages]);
  const filtered=useMemo(()=>filterSharedHistory(messages,{
    kind, query: search, subtype: effectiveSubtype, author, fromDate, toDate, sort
  }),[messages,kind,search,effectiveSubtype,author,fromDate,toDate,sort]);
  const activeExtraFilters=Boolean(author || fromDate || toDate || sort!=='newest');
  const selectedVisible=useMemo(()=>{
    const selected=new Set(selectedIds);
    return filtered.filter(item=>selected.has(item.id));
  },[filtered,selectedIds]);

  useEffect(()=>{
    setSelecting(false);
    setSelectedIds([]);
    setSelectionFeedback('');
  },[kind,conversationId]);

  function toggleMessage(id:string) {
    setSelectionFeedback('');
    setSelectedIds(previous=>{
      if(previous.includes(id))return previous.filter(value=>value!==id);
      if(previous.length>=50)return previous;
      return [...previous,id];
    });
  }

  async function copySelectedLinks() {
    const urls=messageSelectionLinks(conversationId,selectedIds,filtered,window.location.origin);
    if(!urls.length)return;
    try {
      await navigator.clipboard.writeText(urls.join('\n'));
      setSelectionFeedback(en?`${urls.length} message links copied.`:
        `${urls.length} liens vers les messages copiés.`);
    }catch{
      setSelectionFeedback(en?'Clipboard unavailable. Nothing was copied.':
        'Presse-papiers indisponible. Aucun lien copié.');
    }
  }

  async function downloadAttachment(message: SharedMessage) {
    const assetId=message.presentation?.assetId;
    if(!assetId||downloading)return;
    setDownloading(message.id);setDownloadError('');
    try {
      const grant=await apiFetch<{path:string}>(
        `/media/${encodeURIComponent(assetId)}/download-grant`,{method:'POST'}
      );
      // Download grants are temporary, per-user, and server-authorized.
      const expected=`/media/${encodeURIComponent(assetId)}/content?token=`;
      if(typeof grant?.path!=='string'||!grant.path.startsWith(expected))
        throw new Error('INVALID_MEDIA_GRANT');
      const data=await apiFetchBlob(grant.path);
      const original=message.presentation?.fileName||'fichier';
      const filename=original.replace(/[<>:"|?*\x00-\x1f]/g,'_').replaceAll('\\','_').replaceAll('/','_').slice(0,160)||'fichier';
      const url=URL.createObjectURL(data);
      const a=document.createElement('a');a.href=url;a.download=filename;
      document.body.appendChild(a);a.click();a.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),120000);
    }catch(cause){
      setDownloadError(cause instanceof Error ? cause.message :
        en?'Download failed.':'Téléchargement impossible.');
    }finally{setDownloading(null);}
  }
  const labels=TITLES[kind];
  return <section className="km-group-shared-content" role="tabpanel"
    aria-label={en?labels.en:labels.fr} aria-busy={loading}>
    {kind==='search'&&<label className="km-group-shared-search">
      <span>{en?'Search loaded messages':'Rechercher dans les messages chargés'}</span>
      <input type="search" value={search} onChange={event=>setSearch(event.target.value)}
        placeholder={en?'Text, member or file…':'Texte, membre ou fichier…'}
        aria-label={en?(isGroup?'Search group messages':'Search private messages'):(isGroup?'Rechercher les messages du groupe':'Rechercher les messages privés')}/>
    </label>}
    {filterOptions.length>0&&<div className="km-group-shared-filters"
      role="group" aria-label={en?'Filter shared content':'Filtrer les contenus partagés'}>
      {filterOptions.map(option=><button type="button" key={option.value}
        aria-pressed={effectiveSubtype===option.value}
        onClick={()=>setSubtype(option.value)}>
        {en?option.en:option.fr}
      </button>)}
    </div>}
    <div className="km-shared-refine-controls"
      role="group" aria-label={en?'Sort and filter loaded history':'Trier et filtrer l’historique chargé'}>
      <label>
        <span>{en?'From':'Du'}</span>
        <input type="date" value={fromDate} max={toDate||undefined}
          onChange={event=>setFromDate(event.target.value)}
          aria-label={en?'From date':'Date de début'}/>
      </label>
      <label>
        <span>{en?'To':'Au'}</span>
        <input type="date" value={toDate} min={fromDate||undefined}
          onChange={event=>setToDate(event.target.value)}
          aria-label={en?'To date':'Date de fin'}/>
      </label>
      <label>
        <span>{en?'Author':'Auteur'}</span>
        <select value={authors.some(option=>option.key===author)?author:''}
          onChange={event=>setAuthor(event.target.value)}
          aria-label={en?'Message author':'Auteur des messages'}>
          <option value="">{en?'Everyone':'Tout le monde'}</option>
          {authors.map(person=><option key={person.key} value={person.key}>
            {person.label}
          </option>)}
        </select>
      </label>
      <label>
        <span>{en?'Order':'Ordre'}</span>
        <select value={sort} onChange={event=>setSort(event.target.value as SharedHistorySort)}
          aria-label={en?'Message order':'Ordre des messages'}>
          <option value="newest">{en?'Newest first':'Plus récents'}</option>
          <option value="oldest">{en?'Oldest first':'Plus anciens'}</option>
        </select>
      </label>
      {activeExtraFilters&&<button type="button" className="km-shared-reset"
        onClick={()=>{setAuthor('');setFromDate('');setToDate('');setSort('newest');}}>
        {en?'Reset':'Réinitialiser'}
      </button>}
    </div>
    <p className="km-group-shared-scope">
      {en ? 'Filters apply to loaded messages only. Load earlier history to search further back.' :
        'Les filtres portent sur les messages chargés. Charge les anciens messages pour élargir la recherche.'}
    </p>
    <div className="km-group-shared-heading">
      <strong>{en?labels.en:labels.fr}</strong>
      <span>{filtered.length}{cursor?' +':''}</span>
    </div>
    <div className="km-shared-select-bar" role="group"
      aria-label={en?'Select shared messages':'Sélectionner des messages partagés'}>
      <button type="button" aria-pressed={selecting}
        onClick={()=>{
          setSelecting(previous=>!previous);
          setSelectedIds([]);
          setSelectionFeedback('');
        }}>
        {selecting?(en?'Cancel':'Annuler'):(en?'Select':'Sélectionner')}
      </button>
      {selecting&&<>
        <span aria-live="polite">{selectedVisible.length} / 50</span>
        <button type="button" disabled={!selectedVisible.length}
          onClick={()=>void copySelectedLinks()}>
          {en?'Copy message links':'Copier les liens vers les messages'}
        </button>
      </>}
    </div>
    {selectionFeedback&&<p className="km-shared-copy-status" role="status">{selectionFeedback}</p>}
    {downloadError&&<p className="km-group-shared-error" role="alert">{downloadError}</p>}
    {error&&<div className="km-group-shared-error" role="alert">
      <p>{error}</p>
      <button type="button" onClick={()=>void load(initialLoaded?cursor:null)}>
        {en?'Retry':'Réessayer'}</button>
    </div>}
    <div className={kind==='media'?'km-group-shared-grid':'km-group-shared-list'}>
      {filtered.map(item=>{
        const presentation=item.presentation;
        const details=kind==='links'
          ? linksInMessage(presentation?.kind==='TEXT'?presentation.text??item.content:item.content)
          : [];
        const messageHref=`/messages/${encodeURIComponent(conversationId)}?message=${encodeURIComponent(item.id)}`;
        const date=new Date(item.createdAt);
        const dateLabel=Number.isNaN(date.getTime())?'':date.toLocaleDateString(en?'en-US':'fr-FR');
        return <article className="km-group-shared-item" key={item.id}>
          {selecting&&<label className="km-group-shared-checkbox">
            <input type="checkbox" checked={selectedIds.includes(item.id)}
              onChange={()=>toggleMessage(item.id)}
              disabled={!selectedIds.includes(item.id)&&selectedIds.length>=50}
              aria-label={en?
                `Select message from ${item.sender?.displayName||item.sender?.username||'member'} on ${dateLabel}`:
                `Sélectionner le message de ${item.sender?.displayName||item.sender?.username||'membre'} du ${dateLabel}`}/>
          </label>}
          {kind!=='links'&&presentation?.assetId&&
            (presentation.kind==='IMAGE'||presentation.kind==='VIDEO'||
             presentation.kind==='GIF'||presentation.kind==='STICKER_IMAGE'||
             presentation.kind==='AUDIO')&&
            <div className="km-group-shared-preview">
              <ChatMediaView assetId={presentation.assetId} kind={presentation.kind}
                fileName={presentation.fileName} enablePreview />
            </div>}
          {kind==='files'&&presentation?.kind==='DOCUMENT'&&
            <div className="km-group-shared-document">
              <svg viewBox="0 0 24 24" width="23" height="23"
                fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <path d="M5 2.5h9l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20z"/>
                <path d="M14 2.5v6h5M8 13h8M8 17h6"/>
              </svg>
              <span>{presentation.fileName|| (en?'Document':'Document')}</span>
              <button type="button" disabled={downloading===item.id}
                onClick={()=>void downloadAttachment(item)}>
                {downloading===item.id?(en?'Downloading…':'Téléchargement…'):
                  (en?'Download':'Télécharger')}
              </button>
            </div>}
          {kind==='search'&&<p className="km-group-shared-snippet">
            {item.presentation?.kind==='TEXT'?item.presentation.text??item.content:
              item.presentation?.fileName??item.content}
          </p>}
          {kind==='links'&&<div className="km-group-shared-links">
            {details.map(link=><a key={link.url} href={link.url} target="_blank"
              rel="noopener noreferrer" className="km-group-shared-link">
              {link.text}
            </a>)}
          </div>}
          <div className="km-group-shared-meta">
            <span title={item.sender?.displayName ?? ''}>{item.sender?.displayName||item.sender?.username||(en?'Member':'Membre')}</span>
            <time dateTime={item.createdAt}>{dateLabel}</time>
            <Link href={messageHref} className="km-group-shared-origin">
              {en?'View message':'Voir le message'}
            </Link>
          </div>
        </article>;
      })}
    </div>
    {loading && <p className="km-group-shared-status" role="status">
      {en?'Loading shared content…':'Chargement des contenus partagés…'}
    </p>}
    {!loading&&!error&&initialLoaded&&filtered.length===0&&(! (kind==='search'&&!search.trim()))&&
      <p className="km-group-shared-status">
        {cursor
          ? en?'No matches yet in the loaded messages. Load more to search earlier history.'
              :'Aucun résultat dans les messages chargés. Charge la suite pour consulter les anciens messages.'
          : en?'No shared content of this type.':'Aucun contenu partagé de ce type.'}
      </p>}
    {kind==='search'&&!search.trim()&&<p className="km-group-shared-status">
      {en
        ? (isGroup?'Enter a term to search this group history.':'Enter a term to search this private conversation.')
        : (isGroup?'Saisis un terme pour rechercher dans les messages du groupe.':'Saisis un terme pour rechercher dans cette discussion privée.')}
    </p>}
    {!loading&&!error&&cursor&&<button type="button" className="km-group-shared-more"
      onClick={()=>void load(cursor)}>
      {en?'Load older messages':'Charger les messages plus anciens'}
    </button>}
  </section>;
}
