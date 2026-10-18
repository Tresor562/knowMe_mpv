'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch, apiFetchBlob } from '../../../lib/api';
import { useI18n } from '../../../components/i18n-provider';
import {buildKnowMePublicLink} from '@knowme/link-contract';
import styles from './ChatVoiceNote.module.css';
import {getWebChatAudio,subscribeWebChatAudio,toggleWebChatAudio,seekWebChatAudio} from '../web-audio-session';

type MediaKind = 'GIF' | 'STICKER_IMAGE' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
type ChatMediaViewProps = {
  assetId: string;
  kind: MediaKind;
  fileName?: string;
  avatarUrl?: string | null;
  origin?:string;
  sender?:string;
  /** Only enable within chat messages, never inside the picker's interactive media tiles. */
  enablePreview?: boolean;
};

/** Inline controller uses the same audio instance as the sticky top mini bar. */
function InlineAudioPlayer({assetId,en,avatarUrl,sender,origin}:{
 assetId:string;en:boolean;avatarUrl?:string|null;sender?:string;origin?:string;
}) {
 const [s,setS]=useState(getWebChatAudio);
 useEffect(()=>subscribeWebChatAudio(setS),[]);
 const own=s.assetId===assetId;
 const downloaded=own&&s.downloaded;
 const busy=own&&s.phase==='downloading';
 const playing=own&&s.phase==='playing';
 const bars=Array.from({length:30},(_,index)=>6+((index*17+assetId.charCodeAt(index%Math.max(1,assetId.length)))%20));
 const durationLabel=(value:number)=>{
   const secs=Math.floor(Math.max(0,value));return `${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`;
 };
 const progress=own&&s.duration>0?s.position/s.duration:0;
 return <div className={styles.note} role="group" aria-label={en?'Voice message':'Message vocal'}>
   <span className={styles.avatar} aria-hidden="true">{avatarUrl?<img src={avatarUrl}
     alt="" className={styles.avatarImage}/>:<span className={styles.avatarGlyph}>♫</span>}</span>
   <button type="button" className={styles.play} disabled={busy}
     aria-label={playing?(en?'Pause voice message':'Mettre le vocal en pause'):
       downloaded?(en?'Resume voice message':'Reprendre le vocal'):
       (en?'Download and play voice':'Télécharger et lire le vocal')}
     onClick={()=>toggleWebChatAudio(assetId,origin||'Conversation',sender||'Message vocal')}>
     {busy?<span aria-hidden="true">…</span>:playing?
     <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
       fill="none" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>:
     <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"
       aria-hidden="true"><path d="M8 4v16l13-8z"/></svg>}
   </button>
   <div className={styles.content}>
     <div className={styles.wave} aria-hidden="true">
       {bars.map((h,i)=><span key={i} style={{height:h,opacity:i/30<=progress?1:0.4}}/>)}
     </div>
     <input className={styles.seek} type="range" min="0" step=".1"
       disabled={!downloaded} max={Math.max(.1,own?s.duration:0)}
       value={Math.min(own?s.position:0,Math.max(.1,own?s.duration:0))}
       onChange={event=>seekWebChatAudio(Number(event.target.value))}
       aria-label={en?'Seek voice message':'Avancer dans le vocal'}/>
     <small className={styles.time}>{busy?(en?'Downloading…':'Téléchargement…'):
       own&&s.error?s.error:downloaded?
       `${durationLabel(s.position)} / ${durationLabel(s.duration)}`:
       (en?'Not downloaded':'Non téléchargé')}</small>
   </div>
 </div>;
}

export function ChatMediaView({assetId, kind, fileName, enablePreview = false, avatarUrl,origin,sender}: ChatMediaViewProps) {
  const {locale} = useI18n();
  const en = locale === 'en';
  const [source,setSource] = useState<string|null>(null);
  const [failure,setFailure] = useState(false);
  const [attempt,setAttempt] = useState(0);
  const [previewOpen,setPreviewOpen] = useState(false);
  const [stickerOptions,setStickerOptions] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const downloadRef = useRef<HTMLAnchorElement>(null);

  useEffect(()=>{
    if(kind==='AUDIO')return; // Download only after the user actually plays audio.
    let live = true;
    let objectUrl: string | null = null;
    setSource(null);
    setFailure(false);
    setPreviewOpen(false);
    setStickerOptions(false);
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
  if(kind==='AUDIO')return <InlineAudioPlayer assetId={assetId} en={en} avatarUrl={avatarUrl}
    origin={origin} sender={sender}/>;
  if(source&&kind==='DOCUMENT')return <a className="km-chat-media-download"
    href={source} download={fileName ?? 'knowme-document.pdf'} aria-label={fileName??(en?'Download PDF':'Télécharger le PDF')}>
    <span aria-hidden="true">▤</span> {en?'Download PDF':'Télécharger le PDF'}
  </a>;

  const description = kind === 'GIF' ? 'GIF' : kind === 'STICKER_IMAGE' ? 'Sticker' : en ? 'Image' : 'Image';
  if(source){
    const media = <img className={`km-chat-media km-chat-media-${kind.toLowerCase()}`}
      style={kind==='STICKER_IMAGE'?{width:128,height:128,maxWidth:'100%',objectFit:'contain'}:undefined}
      src={source} alt={description} loading="lazy" decoding="async" />;
    if(!enablePreview)return media;

    return <>
      <button className="km-chat-media-trigger" type="button" ref={triggerRef}
        onClick={()=>{setStickerOptions(kind==='STICKER_IMAGE');setPreviewOpen(true);}}
        onContextMenu={kind==='STICKER_IMAGE'?event=>{event.preventDefault();setStickerOptions(false);setPreviewOpen(true);}:undefined}
        aria-label={kind==='STICKER_IMAGE'?(en?'Sticker options':'Options du sticker'):
          en ? `Open ${description} fullscreen` : `Agrandir ${description === 'Image' ? "l'image" : 'le média'}`}>
        {media}
      </button>
      {previewOpen && createPortal(
        <div className="km-chat-media-viewer" role="dialog" aria-modal="true"
          aria-label={en ? 'Media viewer' : 'Visionneuse de médias'}
          onClick={event=>{if(event.target===event.currentTarget)setPreviewOpen(false);}}>
          {kind==='STICKER_IMAGE'&&stickerOptions ? (
          <div className="km-sticker-actions-panel">
            <div className="km-chat-media-viewer-bar">
              <span className="km-chat-media-viewer-title">Sticker KnowMe</span>
              <button ref={closeRef} type="button" onClick={()=>setPreviewOpen(false)}
                aria-label={en?'Close sticker options':'Fermer les options du sticker'}>
                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" fill="none" aria-hidden="true"><path d="M5 5 19 19M19 5 5 19"/></svg>
              </button>
            </div>
            <img className="km-sticker-actions-image" src={source} alt={description}/>
            <div className="km-sticker-actions-buttons">
              <button type="button" onClick={()=>setStickerOptions(false)}>
                {en?'Preview sticker':'Agrandir le sticker'}
              </button>
              <a href={buildKnowMePublicLink({kind:'media',id:assetId})}
                target="_blank" rel="noopener noreferrer">{en?'Open sticker link':'Ouvrir le lien du sticker'}</a>
              <a ref={downloadRef} href={source} download={fileName ?? 'knowme-sticker.png'}>
                {en?'Download sticker':'Télécharger le sticker'}
              </a>
            </div>
            <p className="km-sticker-actions-meta">{fileName ?? 'Sticker KnowMe'}</p>
          </div>
          ):<>
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
          </>}
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
