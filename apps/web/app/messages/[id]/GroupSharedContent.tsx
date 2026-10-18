'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, apiFetchBlob } from '../../../lib/api';
import { ChatMediaView } from './ChatMediaView';
import {
  appendSharedMessages, contentKind, linksInMessage, searchSharedMessages,
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

  const filtered=useMemo(()=>kind==='search'?searchSharedMessages(messages,search):
    messages.filter(message=>contentKind(message).includes(kind)),[messages,kind,search]);

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
    <div className="km-group-shared-heading">
      <strong>{en?labels.en:labels.fr}</strong>
      <span>{filtered.length}{cursor?' +':''}</span>
    </div>
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
      {en?'Enter a term to search this group history.':'Saisis un terme pour rechercher dans les messages du groupe.'}
    </p>}
    {!loading&&!error&&cursor&&<button type="button" className="km-group-shared-more"
      onClick={()=>void load(cursor)}>
      {en?'Load older messages':'Charger les messages plus anciens'}
    </button>}
  </section>;
}
