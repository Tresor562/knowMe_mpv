'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { apiFetch } from '../../../lib/api';
import { useI18n } from '../../../components/i18n-provider';
import { ChatMediaView } from './ChatMediaView';
import { AnimatedEmojiGlyph } from '../../../components/AnimatedEmoji';

type SavedMedia = {
  id:string;
  ownerId:string;
  purpose:string;
  visibility:string;
  conversationId?:string|null;
  detectedMime:string;
  originalName?:string|null;
  status:string;
  deletedAt?:string|null;
};

type Sticker = {
  key: string;
  version: number;
  label: string;
  glyph: string;
  accessibilityLabel: string;
};
type Pack = {
  key: string;
  version: number;
  name: string;
  description: string;
  stickers: Sticker[];
};
type Catalog = {
  schemaVersion: 1;
  packs: Pack[];
  visualOnly: true;
  externalAssetAllowed: false;
  arbitraryHtmlAllowed: false;
  clientAssetAccepted: false;
};

const EMOJI_GROUPS = [
  { key: 'recent', fr: 'Expressions', en: 'Expressions', values: ['😀','😃','😂','🥹','😍','😘','😎','🤔','🥰','😭','🥺','😴','😡','😱','🤯','😇','🙃','🫶','❤️','💙','💜','🔥','✨','🎉','👍','👎','👏','🙏','💯','👀'] },
  { key: 'people', fr: 'Personnes et gestes', en: 'People and gestures', values: ['🙋','🙌','🤝','💪','🤙','✌️','👋','👌','💅','🧑‍💻','👩‍💻','👨‍💻','👑','🧠','👨‍🎨','🧑‍🚀'] },
  { key: 'nature', fr: 'Nature et objets', en: 'Nature and objects', values: ['🐱','🐶','🦋','🌹','🌸','🌻','🌙','⭐','☀️','🌈','🍀','🌍','🎮','🎧','📱','💻','📸','🎁','🚀','⚡'] }
] as const;

export function StickerPicker<T>({
  conversationId,
  onSent,
  onInsertEmoji,
  referenceChat=false,
  draftHasText=false,
  onPanelChange,
  inputSlot
}: {
  conversationId: string;
  onSent: (message: T) => void;
  onInsertEmoji?: (emoji: string) => void;
  referenceChat?: boolean;
  draftHasText?: boolean;
  onPanelChange?: (layout:'closed'|'compact'|'expanded')=>void;
  inputSlot?: ReactNode;
}) {
  const { locale } = useI18n();
  const en = locale === 'en';
  const [open, setOpen] = useState(false);
  useEffect(()=>{onPanelChange?.(!open?'closed':expanded?'expanded':'compact');},[open,expanded,onPanelChange]);
  const [typing,setTyping]=useState(false);
  const [expanded,setExpanded]=useState(false);
  const [selectedPack,setSelectedPack]=useState('');
  const [emojiFilter,setEmojiFilter]=useState<'all'|'recent'|'favorites'|'people'|'nature'>('all');
  const [favorites,setFavorites]=useState<string[]>([]);
  const [queryOpen,setQueryOpen]=useState(false);
  const gestureY=useRef<number|null>(null);
  const [tab, setTab] = useState<'emoji' | 'stickers' | 'gifs' | 'files'>('emoji');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const [savedMedia,setSavedMedia] = useState<SavedMedia[]|null>(null);
  const [savedMediaLoading,setSavedMediaLoading] = useState(false);
  const [savedMediaError,setSavedMediaError] = useState(false);
  const savedMediaRequest = useRef(false);
  const wrap = useRef<HTMLDivElement>(null);
  const searchField = useRef<HTMLInputElement>(null);
  const gifInput = useRef<HTMLInputElement>(null);
  const stickerInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const quickImageInput=useRef<HTMLInputElement>(null);
  const quickAttachmentInput=useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(event.target as Node)) setOpen(false);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', keyboard);
    return () => {
      window.removeEventListener('pointerdown', outside);
      window.removeEventListener('keydown', keyboard);
    };
  }, [open]);

  useEffect(() => {
    if (!open || tab !== 'stickers' || catalog || loading || error) return;
    setLoading(true);
    void apiFetch<Catalog>('/stickers/catalog')
      .then(value => {
        setCatalog(value);
        setError('');
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : (en ? 'Sticker catalog unavailable.' : 'Catalogue des stickers indisponible.')))
      .finally(() => setLoading(false));
  }, [catalog, loading, open, tab, en, error]);

  useEffect(()=>{
    if(!open||(tab!=='gifs'&&tab!=='stickers'&&tab!=='files')||savedMedia!==null||savedMediaRequest.current||savedMediaError)return;
    savedMediaRequest.current=true;
    setSavedMediaLoading(true);
    void apiFetch<SavedMedia[]>('/media/mine')
      .then(items=>setSavedMedia(items))
      .catch(()=>setSavedMediaError(true))
      .finally(()=>{savedMediaRequest.current=false;setSavedMediaLoading(false);});
  },[open,tab,savedMedia,savedMediaError]);

  const reusableGif=(savedMedia??[]).filter(item=>item.conversationId===conversationId&&
    item.purpose==='MESSAGE'&&item.status==='AVAILABLE'&&!item.deletedAt&&item.detectedMime==='image/gif'&&
    (!search.trim()||(item.originalName??'').toLowerCase().includes(search.trim().toLowerCase()))).slice(0,36);
  const reusableStickers=(savedMedia??[]).filter(item=>item.conversationId===conversationId&&
    item.purpose==='MESSAGE'&&item.status==='AVAILABLE'&&!item.deletedAt&&
    ['image/png','image/webp'].includes(item.detectedMime)).slice(0,6);

  const matchingPacks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!catalog) return [];
    return catalog.packs.filter(pack=>!selectedPack||pack.key===selectedPack).map(pack => ({
      pack,
      stickers: query
        ? pack.stickers.filter(sticker => [pack.name, sticker.label, sticker.accessibilityLabel]
          .some(value => value.toLocaleLowerCase().includes(query)))
        : pack.stickers
    })).filter(item => item.stickers.length > 0);
  }, [catalog, search,selectedPack]);

  function chooseEmoji(emoji: string) {
    onInsertEmoji?.(emoji);
    setRecent(current => [emoji, ...current.filter(value => value !== emoji)].slice(0, 24));
  }

  useEffect(()=>{
    try {
      const raw=localStorage.getItem('knowme-web-expressions-v1');
      if(!raw)return;
      const data=JSON.parse(raw) as {recent?:string[];favorites?:string[]};
      if(Array.isArray(data.recent))setRecent(data.recent.slice(0,24));
      if(Array.isArray(data.favorites))setFavorites(data.favorites.slice(0,36));
    } catch {/* Noncritical browser storage unavailability. */}
  },[]);
  useEffect(()=>{
    try{localStorage.setItem('knowme-web-expressions-v1',JSON.stringify({recent,favorites}));}
    catch {/* Current chat still operates without persistent storage. */}
  },[recent,favorites]);
  function toggleFavorite(emoji:string){
    setFavorites(current=>current.includes(emoji)?current.filter(x=>x!==emoji):[emoji,...current].slice(0,36));
  }

  async function send(packKey: string, sticker: Sticker) {
    const operation = `${packKey}:${sticker.key}`;
    if (sending) return;
    setSending(operation);
    try {
      const message = await apiFetch<T>(`/conversations/${conversationId}/stickers`, {
        method: 'POST',
        body: JSON.stringify({ packKey, stickerKey: sticker.key })
      });
      onSent(message);
      setError('');
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (en ? 'Could not send sticker.' : 'Envoi du sticker impossible.'));
    } finally {
      setSending(null);
    }
  }

  async function reuseMedia(assetId:string,kind:'GIF'|'STICKER_IMAGE') {
    if(sending)return;
    setSending(`reuse:${assetId}`);
    setError('');
    try{
      const message=await apiFetch<T>(`/conversations/${encodeURIComponent(conversationId)}/media-messages`,{
        method:'POST',body:JSON.stringify({assetId,kind})
      });
      onSent(message);
      setOpen(false);
    }catch(cause){
      setError(cause instanceof Error?cause.message:(en?'Sending media failed.':'Envoi du média impossible.'));
    }finally{setSending(null);}
  }

  async function uploadAndSend(file:File,kind:'GIF'|'STICKER_IMAGE'|'IMAGE'|'VIDEO'|'AUDIO'|'DOCUMENT') {
    const allowed = kind==='GIF'?['image/gif']:
      kind==='STICKER_IMAGE'?['image/png','image/webp']:
      kind==='VIDEO'?['video/mp4']:
      kind==='AUDIO'?['audio/mpeg','audio/ogg','audio/wav']:
      kind==='DOCUMENT'?['application/pdf']:
      ['image/jpeg','image/png','image/webp'];
    const limit = kind==='STICKER_IMAGE'?8*1024*1024:kind==='GIF'?15*1024*1024:20*1024*1024;
    if(!allowed.includes(file.type)||file.size<1024||file.size>limit) {
      setError(en?`Choose a supported file from 1 KB to ${Math.round(limit/1048576)} MB.`:
        `Choisis un fichier compatible de 1 Ko à ${Math.round(limit/1048576)} Mo.`);
      return;
    }
    if(sending)return;
    setSending('upload');
    setError('');
    try {
      const session = await apiFetch<{id:string;uploadToken:string}>('/media/uploads',{
        method:'POST',
        body:JSON.stringify({purpose:'MESSAGE',visibility:'CONVERSATION',conversationId,
          maxBytes:file.size,allowedMime:[file.type]})
      });
      const data = new FormData();
      data.append('file',file,file.name);
      const asset = await apiFetch<SavedMedia>(`/media/uploads/${encodeURIComponent(session.id)}/complete`,{
        method:'POST',headers:{'x-upload-token':session.uploadToken},body:data
      });
      if(asset.status!=='AVAILABLE')throw new Error(en?
        'Media security scan not complete: nothing was sent.':
        'Analyse de sécurité non validée : aucun message envoyé.');
      const message = await apiFetch<T>(`/conversations/${encodeURIComponent(conversationId)}/media-messages`,{
        method:'POST',body:JSON.stringify({assetId:asset.id,kind})
      });
      onSent(message);
      setSavedMedia(current=>current?[asset,...current.filter(item=>item.id!==asset.id)].slice(0,100):current);
      setOpen(false);
    } catch(cause) {
      setError(cause instanceof Error?cause.message:(en?'Sending media failed.':'Envoi du média impossible.'));
    } finally {setSending(null);}
  }

  return <div className={referenceChat?'km-picker-anchor km-reference-picker':'km-picker-anchor'} ref={wrap}
    onFocusCapture={event=>{if((event.target as HTMLElement).matches('.km-chat-compose-input')){setTyping(true);setOpen(false);}}}
    onBlurCapture={event=>{if((event.target as HTMLElement).matches('.km-chat-compose-input'))setTyping(false);}}>
    <button type="button" className="km-picker-trigger" aria-expanded={open}
      aria-controls="knowme-sticker-picker"
      aria-label={open?(en?'Return to typing':'Revenir au clavier'):(en?'Emoji GIF stickers':'Emojis GIF stickers')}
      onClick={()=>{
        if(open){setOpen(false);wrap.current?.querySelector<HTMLInputElement>('.km-chat-compose-input')?.focus();}
        else {setError('');setTab(typing||draftHasText?'emoji':'stickers');setExpanded(false);setOpen(true);}
      }}>
      {referenceChat&&open?
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
          <rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M6 9h2m2 0h2m2 0h2m2 0h1M6 12h2m2 0h2m2 0h2m2 0h1M8 16h8"/>
        </svg>:referenceChat&&(typing||draftHasText)?
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9.5"/><path d="M8.2 9h.1m7.4 0h.1M7.5 14.6q4.5 5 9 0"/>
        </svg>:
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5"/><path d="M8 14c2.1 3 5.9 3 8 0"/><path d="M8.5 10h.01M15.5 10h.01" strokeWidth="3"/><path d="M16 20q0-4 5-5"/>
        </svg>}
    </button>
    {referenceChat&&<>
      {inputSlot}
      <button type="button" className="km-reference-attach" aria-label={en?'Attach files':'Joindre un fichier'}
        onClick={()=>quickAttachmentInput.current?.click()}>
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
          <path d="M20 11.5 11.2 20a5.5 5.5 0 0 1-7.8-7.8l9.3-9.3a3.8 3.8 0 0 1 5.4 5.4l-9.5 9.5a2 2 0 0 1-2.9-2.8l8.5-8.5"/>
        </svg>
      </button>
      <button type="button" className="km-reference-attach" aria-label={en?'Send a photo':'Envoyer une photo'}
        onClick={()=>quickImageInput.current?.click()}>
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round">
          <rect x="2.5" y="6" width="19" height="15" rx="3"/><path d="M7 6 9 3h6l2 3"/><circle cx="12" cy="13.5" r="3.5"/>
        </svg>
      </button>
      <input hidden ref={quickImageInput} type="file" accept="image/jpeg,image/png,image/webp"
        onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(file)void uploadAndSend(file,'IMAGE');}}/>
      <input hidden ref={quickAttachmentInput} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,audio/mpeg,audio/ogg,audio/wav,application/pdf"
        onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(!file)return;
          const kind=file.type==='video/mp4'?'VIDEO':['audio/mpeg','audio/ogg','audio/wav'].includes(file.type)?'AUDIO':
            file.type==='application/pdf'?'DOCUMENT':['image/jpeg','image/png','image/webp'].includes(file.type)?'IMAGE':null;
          if(kind)void uploadAndSend(file,kind);else setError(en?'Unsupported file type':'Type de fichier non pris en charge');
        }}/>
    </>}
    {open && <section id="knowme-sticker-picker"
      className={`km-picker-sheet ${referenceChat?'km-picker-reference-sheet':''} ${expanded?'km-picker-expanded':''}`}
      role="dialog"
      aria-label={en ? 'Emoji, sticker and GIF selector' : 'Sélecteur d’emojis, stickers et GIF'}>
      {referenceChat&&<>
        <div className="km-picker-drag-handle" role="button" tabIndex={0}
          aria-label={expanded?'Réduire le clavier multimédia':'Agrandir le clavier multimédia'}
          onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setExpanded(value=>!value);}}}
          onPointerDown={event=>{gestureY.current=event.clientY;event.currentTarget.setPointerCapture(event.pointerId);}}
          onPointerUp={event=>{
            if(gestureY.current===null)return;
            const delta=event.clientY-gestureY.current;
            setExpanded(current=>delta < -24?true:delta>24?false:!current);
            gestureY.current=null;
          }}>
          <span/>
        </div>
        <div className="km-reference-pack-strip" aria-label="Packs de stickers et raccourcis">
          <button type="button" aria-label="Favoris" onClick={()=>{setTab('emoji');setEmojiFilter('favorites');}}>☆</button>
          <button type="button" aria-label="Récents" onClick={()=>{setTab('emoji');setEmojiFilter('recent');}}>◷</button>
          {catalog?.packs.slice(0,22).map(pack=><button key={pack.key} type="button"
            aria-label={`Pack ${pack.name}`} aria-pressed={selectedPack===pack.key}
            onClick={()=>{setSelectedPack(pack.key);setTab('stickers');setSearch('');}}>
            {pack.stickers[0]?.glyph??'◈'}
          </button>)}
        </div>
      </>}
      <header className="km-picker-head">
        <strong>{en ? 'Emoji, stickers & GIF' : 'Emojis, stickers et GIF'}</strong>
        <button type="button" className="km-picker-close" onClick={() => setOpen(false)} aria-label={en ? 'Close' : 'Fermer'}>×</button>
      </header>
      <div className="km-picker-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'emoji'} onClick={() => {setTab('emoji');setSearch('');}}>
          Emoji
        </button>
        <button type="button" role="tab" aria-selected={tab === 'stickers'} onClick={() => {setTab('stickers');setSearch('');setError('');}}>
          Stickers
        </button>
        <button type="button" role="tab" aria-selected={tab==='gifs'} onClick={()=>{setTab('gifs');setSearch('');setError('');}}>
          GIF
        </button>
        <button type="button" role="tab" aria-selected={tab==='files'}
          onClick={()=>{setTab('files');setSearch('');setError('');}}>
          {en?'Files':'Fichiers'}
        </button>
      </div>
      <input ref={gifInput} hidden type="file" accept="image/gif" onChange={event=>{
        const file=event.currentTarget.files?.[0];event.currentTarget.value='';
        if(file)void uploadAndSend(file,'GIF');
      }}/>
      <input ref={stickerInput} hidden type="file" accept="image/png,image/webp" onChange={event=>{
        const file=event.currentTarget.files?.[0];event.currentTarget.value='';
        if(file)void uploadAndSend(file,'STICKER_IMAGE');
      }}/>
      <input ref={imageInput} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{
        const file=event.currentTarget.files?.[0];event.currentTarget.value='';
        if(file)void uploadAndSend(file,'IMAGE');
      }}/>
      <input ref={fileInput} hidden type="file" accept="video/mp4,audio/mpeg,audio/ogg,audio/wav,.mp3,.ogg,.wav,application/pdf"
        onChange={event=>{
          const file=event.currentTarget.files?.[0]; event.currentTarget.value='';
          if(!file)return;
          const kind = file.type==='video/mp4'?'VIDEO':['audio/mpeg','audio/ogg','audio/wav'].includes(file.type)?'AUDIO':
            file.type==='application/pdf'?'DOCUMENT':null;
          if(!kind){setError(en?'Use MP4, MP3, OGG, WAV or PDF files.':'Choisis un MP4, MP3, OGG, WAV ou PDF.');return;}
          void uploadAndSend(file,kind);
        }}/>
      {(referenceChat||tab === 'stickers') && <div className="km-picker-search">
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>
        </svg>
        <input ref={searchField} type="search" value={search} onChange={event => setSearch(event.target.value)}
          placeholder={en ? 'Search stickers' : 'Rechercher des stickers'} aria-label={en ? 'Search stickers' : 'Rechercher des stickers'}/>
      </div>}
      {referenceChat&&<div className="km-reference-filters" role="group" aria-label="Catégories">
        <button type="button" aria-label="Tout afficher" aria-pressed={emojiFilter==='all'}
          onClick={()=>{setEmojiFilter('all');setSelectedPack('');}}>◯</button>
        <button type="button" aria-label="Favoris" aria-pressed={emojiFilter==='favorites'}
          onClick={()=>{setTab('emoji');setEmojiFilter('favorites');}}>♡</button>
        <button type="button" aria-label="Récents" aria-pressed={emojiFilter==='recent'}
          onClick={()=>{setTab('emoji');setEmojiFilter('recent');}}>◷</button>
        <button type="button" aria-label="Gestes et réactions" aria-pressed={emojiFilter==='people'}
          onClick={()=>{setTab('emoji');setEmojiFilter('people');}}>👍</button>
        <button type="button" aria-label="Nature et objets" aria-pressed={emojiFilter==='nature'}
          onClick={()=>{setTab('emoji');setEmojiFilter('nature');}}>✨</button>
      </div>}
      {savedMediaLoading&&(tab==='gifs'||tab==='stickers'||tab==='files')&&
        <p role="status" className="km-picker-status">{en?'Loading recent media…':'Chargement des médias récents…'}</p>}
      {savedMediaError&&(tab==='gifs'||tab==='stickers'||tab==='files')&&
        <p className="km-picker-status">{en?'Recent media unavailable; new uploads still work.':
          'Historique indisponible ; tu peux toujours envoyer un nouveau fichier.'}</p>}
      {error && <div role="alert" className="km-picker-error">{error} <button type="button" onClick={()=>setError('')}>{en?'Dismiss':'Fermer'}</button></div>}
      <div className="km-picker-scroll" role="tabpanel">
        {tab === 'emoji' && <>
          {favorites.length>0&&emojiFilter==='favorites'&&<div className="km-picker-group">
            <strong>Favoris</strong><div className="km-picker-emoji-grid">{favorites.map(emoji=>
              <button key={emoji} type="button" onClick={()=>chooseEmoji(emoji)}
                onContextMenu={event=>{event.preventDefault();toggleFavorite(emoji);}}><AnimatedEmojiGlyph glyph={emoji}/></button>)}</div>
          </div>}
          {recent.length > 0 && emojiFilter!=='favorites' && <div className="km-picker-group">
            <strong>{en ? 'Recently used' : 'Récents'}</strong>
            <div className="km-picker-emoji-grid">{recent.map(emoji =>
              <button key={emoji} type="button" aria-label={emoji} onClick={() => chooseEmoji(emoji)}
                onContextMenu={event=>{event.preventDefault();toggleFavorite(emoji);}}><AnimatedEmojiGlyph glyph={emoji}/></button>
            )}</div>
          </div>}
          {emojiFilter!=='recent'&&emojiFilter!=='favorites'&&EMOJI_GROUPS.filter(group=>emojiFilter==='all'||group.key===emojiFilter).map(group => <div key={group.key} className="km-picker-group">
            <strong>{en ? group.en : group.fr}</strong>
            <div className="km-picker-emoji-grid">{group.values.map(emoji =>
              <button key={emoji} type="button" aria-label={emoji} onClick={() => chooseEmoji(emoji)}><AnimatedEmojiGlyph glyph={emoji}/></button>
            )}</div>
          </div>)}
        </>}
        {tab === 'files' && <div className="km-picker-group km-picker-upload-panel">
          <strong>{en?'Send a video, audio or PDF':'Envoyer une vidéo, un audio ou un PDF'}</strong>
          <p>{en?'Private attachments shared only with this chat. Supported: MP4, MP3, OGG, WAV, PDF.':
            'Pièces jointes privées pour cette conversation : MP4, MP3, OGG, WAV et PDF.'}</p>
          <button type="button" className="km-picker-upload-action" disabled={sending!==null}
            onClick={()=>fileInput.current?.click()}>
            {sending==='upload'?(en?'Sending…':'Envoi…'):(en?'Choose video / audio / PDF':'Choisir vidéo / audio / PDF')}
          </button>
          <small>{en?'Up to 20 MB per file using the current secure upload service.':
            '20 Mo maximum par fichier avec le service de stockage sécurisé actuel.'}</small>
        </div>}
        {tab === 'gifs' && <div className="km-picker-group km-picker-upload-panel">
          {reusableGif.length>0&&<>
            <strong>{en?'Recently sent GIFs':'GIF récents'}</strong>
            <div className="km-picker-media-grid">{reusableGif.map(item=><div className="km-picker-media-tile" key={item.id}>
              <ChatMediaView assetId={item.id} kind="GIF"/>
              <button type="button" disabled={sending!==null}
                aria-label={en?'Send this GIF again':'Renvoyer ce GIF'}
                onClick={()=>void reuseMedia(item.id,'GIF')}>{en?'Send':'Envoyer'}</button>
            </div>)}</div>
          </>}
          <strong>{en?'Animated GIFs':'GIF animés'}</strong>
          <p>{en?'Send GIF files from your gallery, privately shared with conversation members.':
            'Envoie un GIF de ta galerie, accessible uniquement aux membres de la discussion.'}</p>
          <button type="button" className="km-picker-upload-action" disabled={sending!==null}
            onClick={()=>gifInput.current?.click()}>
            {sending==='upload'?(en?'Uploading…':'Envoi en cours…'):(en?'Choose a GIF':'Choisir un GIF')}
          </button>
          <button type="button" className="km-picker-upload-secondary" disabled={sending!==null}
            onClick={()=>imageInput.current?.click()}>
            {en?'Send an image':'Envoyer une image'}
          </button>
          <small>{en?'GIF up to 15 MB · No external GIF search provider connected.':
            'GIF jusqu’à 15 Mo · Aucun moteur GIF externe connecté.'}</small>
        </div>}
        {tab === 'stickers' && <>
          <div className="km-picker-group km-picker-upload-panel">
            {reusableStickers.length>0&&<>
              <strong>{en?'Recently sent image stickers':'Stickers images récents'}</strong>
              <div className="km-picker-media-grid">{reusableStickers.map(item=><div className="km-picker-media-tile" key={item.id}>
                <ChatMediaView assetId={item.id} kind="STICKER_IMAGE"/>
                <button type="button" disabled={sending!==null}
                  aria-label={en?'Send this sticker again':'Renvoyer ce sticker'}
                  onClick={()=>void reuseMedia(item.id,'STICKER_IMAGE')}>{en?'Send':'Envoyer'}</button>
              </div>)}</div>
            </>}
            <strong>{en?'Your image stickers':'Tes stickers images'}</strong>
            <p>{en?'Send a PNG or WebP as a real image sticker, not an emoji substitute.':
              'Envoie un PNG ou WebP comme véritable sticker image, et non comme simple emoji.'}</p>
            <button type="button" className="km-picker-upload-action" disabled={sending!==null}
              onClick={()=>stickerInput.current?.click()}>
              {sending==='upload'?(en?'Uploading…':'Envoi en cours…'):(en?'Choose PNG / WebP':'Choisir PNG / WebP')}
            </button>
            <small>{en?'Max 8 MB; animated WebP playback depends on browser support.':
              '8 Mo maximum ; les WebP animés dépendent du navigateur.'}</small>
          </div>
          {loading && <p role="status" className="km-picker-status">{en ? 'Loading stickers…' : 'Chargement des stickers…'}</p>}

          {!loading && !error && matchingPacks.length === 0 && <p className="km-picker-status">
            {en ? 'No stickers found.' : 'Aucun sticker trouvé.'}
          </p>}
          {matchingPacks.map(({pack, stickers}) => <div className="km-picker-group" key={`${pack.key}:${pack.version}`}>
            <strong>{pack.name}</strong>
            <div className="km-picker-sticker-grid">{stickers.map(sticker => {
              const operation = `${pack.key}:${sticker.key}`;
              return <button key={`${sticker.key}:${sticker.version}`} type="button"
                aria-label={en ? `Send sticker: ${sticker.accessibilityLabel}` : `Envoyer le sticker : ${sticker.accessibilityLabel}`}
                title={sticker.accessibilityLabel} disabled={sending !== null}
                onClick={() => void send(pack.key, sticker)}>
                <span aria-hidden="true">{sticker.glyph}</span>
                <small>{sending === operation ? '…' : sticker.label}</small>
              </button>;
            })}</div>
          </div>)}
        </>}
      </div>
    </section>}
  </div>;
}
