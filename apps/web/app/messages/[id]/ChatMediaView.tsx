'use client';

import { useEffect, useState } from 'react';
import { apiFetch, apiFetchBlob } from '../../../lib/api';
import { useI18n } from '../../../components/i18n-provider';

type MediaKind = 'GIF' | 'STICKER_IMAGE' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';

export function ChatMediaView({assetId, kind}: {assetId: string; kind: MediaKind}) {
  const {locale} = useI18n();
  const en = locale === 'en';
  const [source,setSource] = useState<string|null>(null);
  const [failure,setFailure] = useState(false);
  const [attempt,setAttempt] = useState(0);

  useEffect(()=>{
    let live = true;
    let objectUrl: string | null = null;
    setSource(null);
    setFailure(false);
    void (async ()=>{
      try {
        const grant = await apiFetch<{path:string}>(`/media/${encodeURIComponent(assetId)}/download-grant`,{method:'POST'});
        // Do not expose the short-lived grant in an <img> URL or external host.
        const data = await apiFetchBlob(grant.path);
        const supported = kind==='VIDEO' ? data.type==='video/mp4' :
          kind==='AUDIO' ? data.type==='audio/mpeg' :
          kind==='DOCUMENT' ? data.type==='application/pdf' : data.type.startsWith('image/');
        if (!supported) throw new Error('INVALID_MEDIA_MIME');
        if (!live) return;
        objectUrl = URL.createObjectURL(data);
        setSource(objectUrl);
      } catch {
        if(live)setFailure(true);
      }
    })();
    return ()=>{
      live=false;
      if(objectUrl)URL.revokeObjectURL(objectUrl);
    };
  },[assetId,attempt]);

  if(source&&kind==='VIDEO')return <video className="km-chat-media km-chat-media-video"
    controls playsInline preload="metadata" src={source} aria-label={en?'Video attachment':'Vidéo jointe'}/>;
  if(source&&kind==='AUDIO')return <audio className="km-chat-media-audio"
    controls preload="metadata" src={source} aria-label={en?'Audio attachment':'Fichier audio'}/>;
  if(source&&kind==='DOCUMENT')return <a className="km-chat-media-download"
    href={source} download="knowme-document.pdf" aria-label={en?'Download PDF':'Télécharger le PDF'}>
    <span aria-hidden="true">▤</span> {en?'Download PDF':'Télécharger le PDF'}
  </a>;
  const description = kind === 'GIF' ? 'GIF' : kind === 'STICKER_IMAGE' ? 'Sticker' : en ? 'Image' : 'Image';
  if(source)return <img className={`km-chat-media km-chat-media-${kind.toLowerCase()}`}
    src={source} alt={description} loading="lazy" decoding="async" />;
  if(failure)return <div className="km-chat-media-fallback" role="status">
    <span>{en?'Media unavailable':'Média indisponible'}</span>
    <button type="button" onClick={()=>setAttempt(value=>value+1)}>{en?'Retry':'Réessayer'}</button>
  </div>;
  return <div className="km-chat-media-loading" role="status">{en?'Loading media…':'Chargement du média…'}</div>;
}
