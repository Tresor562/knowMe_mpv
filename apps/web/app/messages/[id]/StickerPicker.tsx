'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useI18n } from '../../../components/i18n-provider';
import { ChatMediaView } from './ChatMediaView';

type SavedMedia = {
  id:string;
  ownerId:string;
  purpose:string;
  visibility:string;
  conversationId?:string|null;
  detectedMime:string;
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
  onInsertEmoji
}: {
  conversationId: string;
  onSent: (message: T) => void;
  onInsertEmoji?: (emoji: string) => void;
}) {
  const { locale } = useI18n();
  const en = locale === 'en';
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'emoji' | 'stickers' | 'gifs'>('emoji');
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
    if(!open||(tab!=='gifs'&&tab!=='stickers')||savedMedia!==null||savedMediaRequest.current||savedMediaError)return;
    savedMediaRequest.current=true;
    setSavedMediaLoading(true);
    void apiFetch<SavedMedia[]>('/media/mine')
      .then(items=>setSavedMedia(items))
      .catch(()=>setSavedMediaError(true))
      .finally(()=>{savedMediaRequest.current=false;setSavedMediaLoading(false);});
  },[open,tab,savedMedia,savedMediaError]);

  const reusableGif=(savedMedia??[]).filter(item=>item.conversationId===conversationId&&
    item.purpose==='MESSAGE'&&item.status==='AVAILABLE'&&!item.deletedAt&&item.detectedMime==='image/gif').slice(0,6);
  const reusableStickers=(savedMedia??[]).filter(item=>item.conversationId===conversationId&&
    item.purpose==='MESSAGE'&&item.status==='AVAILABLE'&&!item.deletedAt&&
    ['image/png','image/webp'].includes(item.detectedMime)).slice(0,6);

  const matchingPacks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!catalog) return [];
    return catalog.packs.map(pack => ({
      pack,
      stickers: query
        ? pack.stickers.filter(sticker => [pack.name, sticker.label, sticker.accessibilityLabel]
          .some(value => value.toLocaleLowerCase().includes(query)))
        : pack.stickers
    })).filter(item => item.stickers.length > 0);
  }, [catalog, search]);

  function chooseEmoji(emoji: string) {
    onInsertEmoji?.(emoji);
    setRecent(current => [emoji, ...current.filter(value => value !== emoji)].slice(0, 24));
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

  async function uploadAndSend(file:File,kind:'GIF'|'STICKER_IMAGE'|'IMAGE') {
    const allowed = kind==='GIF'?['image/gif']:
      kind==='STICKER_IMAGE'?['image/png','image/webp']:
      ['image/jpeg','image/png','image/webp'];
    const limit = kind==='STICKER_IMAGE'?8*1024*1024:kind==='GIF'?15*1024*1024:20*1024*1024;
    if(!allowed.includes(file.type)||file.size<1024||file.size>limit) {
      setError(en?`Choose a supported image from 1 KB to ${Math.round(limit/1048576)} MB.`:
        `Choisis une image compatible de 1 Ko à ${Math.round(limit/1048576)} Mo.`);
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

  return <div className="km-picker-anchor" ref={wrap}>
    <button type="button" className="km-picker-trigger" aria-expanded={open}
      aria-controls="knowme-sticker-picker" aria-label={en ? 'Emoji, stickers, GIF and photos' : 'Emojis, stickers, GIF et photos'}
      onClick={() => {if (!open) setError(''); setOpen(value => !value);}}>
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="6"/><path d="M8 14c2.1 3 5.9 3 8 0"/><path d="M8.5 10h.01M15.5 10h.01" strokeWidth="3"/>
      </svg>
    </button>
    {open && <section id="knowme-sticker-picker" className="km-picker-sheet" role="dialog"
      aria-label={en ? 'Emoji, sticker and GIF selector' : 'Sélecteur d’emojis, stickers et GIF'}>
      <header className="km-picker-head">
        <strong>{en ? 'Emoji, stickers & GIF' : 'Emojis, stickers et GIF'}</strong>
        <button type="button" className="km-picker-close" onClick={() => setOpen(false)} aria-label={en ? 'Close' : 'Fermer'}>×</button>
      </header>
      <div className="km-picker-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'emoji'} onClick={() => {setTab('emoji');setSearch('');}}>
          {en ? 'Emoji' : 'Emojis'}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'stickers'} onClick={() => {setTab('stickers');setSearch('');setError('');}}>
          Stickers
        </button>
        <button type="button" role="tab" aria-selected={tab==='gifs'} onClick={()=>{setTab('gifs');setSearch('');setError('');}}>
          GIF
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
      {tab === 'stickers' && <div className="km-picker-search">
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>
        </svg>
        <input ref={searchField} type="search" value={search} onChange={event => setSearch(event.target.value)}
          placeholder={en ? 'Search stickers' : 'Rechercher des stickers'} aria-label={en ? 'Search stickers' : 'Rechercher des stickers'}/>
      </div>}
      {savedMediaError&&(tab==='gifs'||tab==='stickers')&&
        <p className="km-picker-status">{en?'Recent media unavailable; new uploads still work.':
          'Historique indisponible ; tu peux toujours envoyer un nouveau fichier.'}</p>}
      {error && <div role="alert" className="km-picker-error">{error} <button type="button" onClick={()=>setError('')}>{en?'Dismiss':'Fermer'}</button></div>}
      <div className="km-picker-scroll" role="tabpanel">
        {tab === 'emoji' && <>
          {recent.length > 0 && <div className="km-picker-group">
            <strong>{en ? 'Recently used' : 'Récents'}</strong>
            <div className="km-picker-emoji-grid">{recent.map(emoji =>
              <button key={emoji} type="button" aria-label={emoji} onClick={() => chooseEmoji(emoji)}>{emoji}</button>
            )}</div>
          </div>}
          {EMOJI_GROUPS.map(group => <div key={group.key} className="km-picker-group">
            <strong>{en ? group.en : group.fr}</strong>
            <div className="km-picker-emoji-grid">{group.values.map(emoji =>
              <button key={emoji} type="button" aria-label={emoji} onClick={() => chooseEmoji(emoji)}>{emoji}</button>
            )}</div>
          </div>)}
        </>}
        {tab === 'gifs' && <div className="km-picker-group km-picker-upload-panel">
          {reusableGif.length>0&&<>
            <strong>{en?'Recently sent GIFs':'GIF récents'}</strong>
            <div className="km-picker-media-grid">{reusableGif.map(item=><button type="button" key={item.id}
              disabled={sending!==null} aria-label={en?'Send this GIF again':'Renvoyer ce GIF'}
              onClick={()=>void reuseMedia(item.id,'GIF')}>
              <ChatMediaView assetId={item.id} kind="GIF"/>
            </button>)}</div>
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
              <div className="km-picker-media-grid">{reusableStickers.map(item=><button type="button" key={item.id}
                disabled={sending!==null} aria-label={en?'Send this sticker again':'Renvoyer ce sticker'}
                onClick={()=>void reuseMedia(item.id,'STICKER_IMAGE')}>
                <ChatMediaView assetId={item.id} kind="STICKER_IMAGE"/>
              </button>)}</div>
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
