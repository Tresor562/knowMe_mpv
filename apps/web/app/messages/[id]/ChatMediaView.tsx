'use client';

import { useEffect, useState } from 'react';
import { apiFetch, apiFetchBlob } from '../../../lib/api';
import { useI18n } from '../../../components/i18n-provider';

type MediaKind = 'GIF' | 'STICKER_IMAGE' | 'IMAGE';

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
        if (!data.type.startsWith('image/')) throw new Error('INVALID_IMAGE_MIME');
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

  const description = kind === 'GIF' ? 'GIF' : kind === 'STICKER_IMAGE' ? 'Sticker' : en ? 'Image' : 'Image';
  if(source)return <img className={`km-chat-media km-chat-media-${kind.toLowerCase()}`}
    src={source} alt={description} loading="lazy" decoding="async" />;
  if(failure)return <div className="km-chat-media-fallback" role="status">
    <span>{en?'Media unavailable':'Média indisponible'}</span>
    <button type="button" onClick={()=>setAttempt(value=>value+1)}>{en?'Retry':'Réessayer'}</button>
  </div>;
  return <div className="km-chat-media-loading" role="status">{en?'Loading media…':'Chargement du média…'}</div>;
}
