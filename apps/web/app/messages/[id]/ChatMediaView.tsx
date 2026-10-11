'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch, apiFetchBlob } from '../../../lib/api';
import { useI18n } from '../../../components/i18n-provider';

type MediaKind = 'GIF' | 'STICKER_IMAGE' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
type ChatMediaViewProps = {
  assetId: string;
  kind: MediaKind;
  fileName?: string;
  /** Only enable within chat messages, never inside the picker's interactive media tiles. */
  enablePreview?: boolean;
};

export function ChatMediaView({assetId, kind, fileName, enablePreview = false}: ChatMediaViewProps) {
  const {locale} = useI18n();
  const en = locale === 'en';
  const [source,setSource] = useState<string|null>(null);
  const [failure,setFailure] = useState(false);
  const [attempt,setAttempt] = useState(0);
  const [previewOpen,setPreviewOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const downloadRef = useRef<HTMLAnchorElement>(null);

  useEffect(()=>{
    let live = true;
    let objectUrl: string | null = null;
    setSource(null);
    setFailure(false);
    setPreviewOpen(false);
    void (async ()=>{
      try {
        const grant = await apiFetch<{path:string}>(`/media/${encodeURIComponent(assetId)}/download-grant`,{method:'POST'});
        // Keep private grants in authenticated fetches, never in image src attributes.
        const data = await apiFetchBlob(grant.path);
        const supported = kind==='VIDEO' ? data.type==='video/mp4' :
          kind==='AUDIO' ? ['audio/mpeg','audio/ogg','audio/wav'].includes(data.type) :
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
  },[assetId,kind,attempt]);

  useEffect(()=>{
    if(!previewOpen)return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if(event.key === 'Escape'){
        event.preventDefault();
        setPreviewOpen(false);
        return;
      }
      if(event.key !== 'Tab')return;
      const controls = [closeRef.current, downloadRef.current].filter(
        (element): element is HTMLButtonElement | HTMLAnchorElement => Boolean(element)
      );
      if(!controls.length)return;
      const first = controls[0];
      const last = controls[controls.length-1];
      if(event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as typeof first))){
        event.preventDefault();
        last.focus();
      } else if(!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement as typeof first))){
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return ()=>{
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      const destination = triggerRef.current ?? previouslyFocused;
      if(destination?.isConnected)destination.focus();
    };
  },[previewOpen]);

  if(source&&kind==='VIDEO')return <video className="km-chat-media km-chat-media-video"
    controls playsInline preload="metadata" src={source} aria-label={en?'Video attachment':'Vidéo jointe'}/>;
  if(source&&kind==='AUDIO')return <audio className="km-chat-media-audio"
    controls preload="metadata" src={source} aria-label={en?'Audio attachment':'Fichier audio'}/>;
  if(source&&kind==='DOCUMENT')return <a className="km-chat-media-download"
    href={source} download={fileName ?? 'knowme-document.pdf'} aria-label={fileName??(en?'Download PDF':'Télécharger le PDF')}>
    <span aria-hidden="true">▤</span> {en?'Download PDF':'Télécharger le PDF'}
  </a>;

  const description = kind === 'GIF' ? 'GIF' : kind === 'STICKER_IMAGE' ? 'Sticker' : en ? 'Image' : 'Image';
  if(source){
    const media = <img className={`km-chat-media km-chat-media-${kind.toLowerCase()}`}
      src={source} alt={description} loading="lazy" decoding="async" />;
    if(!enablePreview)return media;

    return <>
      <button className="km-chat-media-trigger" type="button" ref={triggerRef}
        onClick={()=>setPreviewOpen(true)}
        aria-label={en ? `Open ${description} fullscreen` : `Agrandir ${description === 'Image' ? "l'image" : 'le média'}`}>
        {media}
      </button>
      {previewOpen && createPortal(
        <div className="km-chat-media-viewer" role="dialog" aria-modal="true"
          aria-label={en ? 'Media viewer' : 'Visionneuse de médias'}
          onClick={event=>{if(event.target===event.currentTarget)setPreviewOpen(false);}}>
          <div className="km-chat-media-viewer-bar">
            <span className="km-chat-media-viewer-title">{fileName ?? description}</span>
            <div className="km-chat-media-viewer-actions">
              <a ref={downloadRef} href={source} download={fileName ?? (kind === 'GIF' ? 'knowme.gif' : 'knowme-image')}
                aria-label={en ? 'Download media' : 'Télécharger le média'} title={en ? 'Download' : 'Télécharger'}>
                <svg viewBox="0 0 24 24" width="23" height="23" stroke="currentColor" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v12m-4-4 4 4 4-4M5 17v3h14v-3"/>
                </svg>
              </a>
              <button ref={closeRef} type="button" onClick={()=>setPreviewOpen(false)}
                aria-label={en ? 'Close media viewer' : 'Fermer la visionneuse'} title={en ? 'Close' : 'Fermer'}>
                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" aria-hidden="true">
                  <path d="M5 5 19 19M19 5 5 19"/>
                </svg>
              </button>
            </div>
          </div>
          <img className="km-chat-media-viewer-image" src={source} alt={description} draggable={false} />
        </div>, document.body
      )}
    </>;
  }
  if(failure)return <div className="km-chat-media-fallback" role="status">
    <span>{en?'Media unavailable':'Média indisponible'}</span>
    <button type="button" onClick={()=>setAttempt(value=>value+1)}>{en?'Retry':'Réessayer'}</button>
  </div>;
  return <div className="km-chat-media-loading" role="status">{en?'Loading media…':'Chargement du média…'}</div>;
}
