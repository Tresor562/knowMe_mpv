'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { ChatMediaView } from './ChatMediaView';
import {
  appendSharedMessages, contentKind, linksInMessage,
  type SharedContentKind, type SharedMessage
} from './group-shared-content-model';
import './group-shared-content.css';

type History = { items: SharedMessage[]; nextCursor?: string | null };

const TITLES: Record<SharedContentKind, {fr: string; en: string}> = {
  media: {fr:'Médias partagés',en:'Shared media'},
  files: {fr:'Fichiers partagés',en:'Shared files'},
  links: {fr:'Liens partagés',en:'Shared links'}
};

export function GroupSharedContent({
  conversationId, kind, en
}: {conversationId: string; kind: SharedContentKind; en: boolean}) {
  const [messages,setMessages] = useState<SharedMessage[]>([]);
  const [cursor,setCursor] = useState<string|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
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

  const filtered=useMemo(()=>messages.filter(message=>contentKind(message).includes(kind)),[messages,kind]);
  const labels=TITLES[kind];
  return <section className="km-group-shared-content" role="tabpanel"
    aria-label={en?labels.en:labels.fr} aria-busy={loading}>
    <div className="km-group-shared-heading">
      <strong>{en?labels.en:labels.fr}</strong>
      <span>{filtered.length}{cursor?' +':''}</span>
    </div>
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
             presentation.kind==='AUDIO'||presentation.kind==='DOCUMENT')&&
            <div className="km-group-shared-preview">
              <ChatMediaView assetId={presentation.assetId} kind={presentation.kind}
                fileName={presentation.fileName} enablePreview />
            </div>}
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
    {!loading&&!error&&initialLoaded&&filtered.length===0&&
      <p className="km-group-shared-status">
        {cursor
          ? en?'No matches yet in the loaded messages. Load more to search earlier history.'
              :'Aucun résultat dans les messages chargés. Charge la suite pour consulter les anciens messages.'
          : en?'No shared content of this type.':'Aucun contenu partagé de ce type.'}
      </p>}
    {!loading&&!error&&cursor&&<button type="button" className="km-group-shared-more"
      onClick={()=>void load(cursor)}>
      {en?'Load older messages':'Charger les messages plus anciens'}
    </button>}
  </section>;
}
