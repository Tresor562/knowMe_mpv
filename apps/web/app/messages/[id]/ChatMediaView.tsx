'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch, apiFetchBlob } from '../../../lib/api';
import { useI18n } from '../../../components/i18n-provider';
import {buildKnowMePublicLink} from '@knowme/link-contract';
import styles from './ChatVoiceNote.module.css';

type MediaKind = 'GIF' | 'STICKER_IMAGE' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
type ChatMediaViewProps = {
  assetId: string;
  kind: MediaKind;
  fileName?: string;
  avatarUrl?: string | null;
  /** Only enable within chat messages, never inside the picker's interactive media tiles. */
  enablePreview?: boolean;
};

/** Message audio with native browser media controls under a KnowMe waveform UI. */
function InlineAudioPlayer({source,assetId,en,avatarUrl}:{source:string;assetId:string;en:boolean;avatarUrl?:string|null}) {
  const audio=useRef<HTMLAudioElement|null>(null);
  const [playing,setPlaying]=useState(false);
  const [duration,setDuration]=useState(0);
  const [position,setPosition]=useState(0);
  const [failure,setFailure]=useState(false);
  const durationLabel=(value:number)=>{
    if(!Number.isFinite(value))return '0:00';
    const secs=Math.floor(value);
    return `${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`;
  };
  useEffect(()=>()=>{audio.current?.pause();},[]);
  const bars=Array.from({length:32},(_,index)=>6+((index*17+assetId.charCodeAt(index%Math.max(1,assetId.length)))%20));
  return <div className={styles.note} role="group" aria-label={en?'Voice message':'Message vocal'}>
    <span className={styles.avatar} aria-hidden="true">{avatarUrl?<img src={avatarUrl} alt="" className={styles.avatarImage}/>:<span className={styles.avatarGlyph}>♫</span>}</span>
    <button type="button" className={styles.play} disabled={failure}
      aria-label={playing?(en?'Pause voice message':'Mettre le vocal en pause'):(en?'Play voice message':'Lire le message vocal')}
      onClick={()=>{const player=audio.current;if(!player)return;
        if(player.paused){void player.play().catch(()=>setFailure(true));}
        else player.pause();
      }}>{playing?'Ⅱ':'▶'}</button>
    <div className={styles.content}>
      <div className={styles.wave} aria-hidden="true">
        {bars.map((height,index)=><span key={index} style={{height,opacity:index/32<=position/Math.max(duration,0.001)?1:0.5}}/>)}
      </div>
      <input className={styles.seek} type="range" min="0" step="0.1"
        max={Math.max(0.1,duration)} value={Math.min(position,Math.max(0.1,duration))}
        onChange={event=>{if(audio.current)audio.current.currentTime=Number(event.target.value);}}
        aria-label={en?'Seek voice message':'Avancer dans le message vocal'}/>
      <small className={styles.time}>{failure?(en?'Audio unavailable':'Audio indisponible'):`${durationLabel(position)} / ${durationLabel(duration)}`}</small>
    </div>
    <audio ref={audio} src={source} preload="metadata"
      onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)}
      onTimeUpdate={event=>setPosition(event.currentTarget.currentTime)}
      onLoadedMetadata={event=>setDuration(Number.isFinite(event.currentTarget.duration)?event.currentTarget.duration:0)}
      onError={()=>{setFailure(true);setPlaying(false);}}/>
  </div>;
}

export function ChatMediaView({assetId, kind, fileName, enablePreview = false, avatarUrl}: ChatMediaViewProps) {
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
  if(source&&kind==='AUDIO')return <InlineAudioPlayer source={source} assetId={assetId} en={en} avatarUrl={avatarUrl}/>;
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
