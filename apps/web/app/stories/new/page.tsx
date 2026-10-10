'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '../../../components/i18n-provider';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/use-session';
import { storyUi } from '../story-i18n';

type StoryResponse = { id: string };
type UploadSession = { id: string; uploadToken: string };
type UploadedAsset = { id: string; status: string };
type StoryKind = 'TEXT' | 'PHOTO' | 'VIDEO' | 'LINK';

const PHOTO_MIMES = ['image/jpeg','image/png','image/webp','image/gif'];
const VIDEO_MIMES = ['video/mp4'];
const MAX_STORY_BYTES = 20 * 1024 * 1024;
const DURATIONS = [6,12,24,48,72,168,336,720] as const;

export default function NewStoryPage() {
  const { locale } = useI18n();
  const en = locale === 'en';
  const ui = storyUi(locale === 'en' ? 'en' : 'fr');
  const router = useRouter();
  const { user, loading } = useSession({required:true});
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [type,setType] = useState<StoryKind>('TEXT');
  const [audience,setAudience] = useState('FRIENDS');
  const [durationHours,setDurationHours] = useState(24);
  const [permanent,setPermanent] = useState(false);
  const [allowReplies,setAllowReplies] = useState(true);
  const [allowReactions,setAllowReactions] = useState(true);
  const [allowSharing,setAllowSharing] = useState(true);
  const [publishing,setPublishing] = useState(false);
  const [message,setMessage] = useState('');
  const [file,setFile] = useState<File|null>(null);
  const [previewUrl,setPreviewUrl] = useState<string|null>(null);
  const premium = Boolean(user?.premium);

  useEffect(() => {
    return () => { if(previewUrl) URL.revokeObjectURL(previewUrl); };
  },[previewUrl]);

  function chooseType(next:StoryKind) {
    setMessage('');
    if(next==='PHOTO') {photoRef.current?.click();return;}
    if(next==='VIDEO') {videoRef.current?.click();return;}
    setType(next);
    setFile(null);
    setPreviewUrl(null);
  }

  function chooseFile(event:ChangeEvent<HTMLInputElement>,kind:'PHOTO'|'VIDEO') {
    const selected=event.currentTarget.files?.[0];
    event.currentTarget.value='';
    if(!selected)return;
    const allowed = kind==='PHOTO'?PHOTO_MIMES:VIDEO_MIMES;
    if(!allowed.includes(selected.type) || selected.size>MAX_STORY_BYTES || selected.size<1024) {
      setMessage(en?'Choose a supported file between 1 KB and 20 MB.':'Choisis un fichier compatible de 1 Ko à 20 Mo.');
      return;
    }
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setType(kind);
    setMessage('');
  }

  async function uploadStoryMedia():Promise<string|undefined> {
    if(type!=='PHOTO'&&type!=='VIDEO')return undefined;
    if(!file)throw new Error(en?'Choose a photo or video first.':'Choisis une photo ou une vidéo.');
    const session=await apiFetch<UploadSession>('/media/uploads',{
      method:'POST',
      body:JSON.stringify({
        purpose:'STORY',visibility:'PRIVATE',maxBytes:Math.max(1024,file.size),allowedMime:[file.type]
      })
    });
    const body=new FormData();
    body.append('file',file,file.name);
    const asset=await apiFetch<UploadedAsset>(`/media/uploads/${session.id}/complete`,{
      method:'POST',headers:{'x-upload-token':session.uploadToken},body
    });
    if(asset.status && asset.status!=='AVAILABLE')throw new Error(en?'Security analysis is unavailable or this media was rejected. The story was not published.':'Analyse de sécurité indisponible ou média refusé. La story n’a pas été publiée.');
    return asset.id;
  }

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(publishing)return;
    const data=new FormData(event.currentTarget);
    const caption=String(data.get('caption')??'').trim();
    const linkUrl=String(data.get('linkUrl')??'').trim();
    if(type==='TEXT'&&!caption){setMessage(en?'Write something first.':'Ajoute un texte avant de publier.');return;}
    if(type==='LINK'&&!linkUrl){setMessage(en?'Add a link.':'Ajoute un lien.');return;}
    if((type==='PHOTO'||type==='VIDEO')&&!file){setMessage(en?'Choose a file.':'Choisis un fichier.');return;}
    const hashtags=String(data.get('hashtags')??'').split(/[\s,]+/).map(v=>v.replace(/^#/,'').trim()).filter(Boolean).slice(0,30);
    setPublishing(true);
    setMessage('');
    try{
      const assetId=await uploadStoryMedia();
      const story=await apiFetch<StoryResponse>('/stories',{
        method:'POST',
        body:JSON.stringify({
          type, audience,caption:caption||undefined,assetId,
          linkUrl:type==='LINK'?linkUrl:undefined,
          hashtags,
          durationHours:permanent?undefined:durationHours,
          permanent, allowReplies,allowReactions,allowSharing,
          background:type==='TEXT'?{preset:'knowme-gradient',alignment:'center'}:undefined
        })
      });
      router.replace(`/stories/${story.id}`);
    } catch(cause) {
      setMessage(cause instanceof Error?cause.message:ui.unavailable);
    } finally {setPublishing(false);}
  }

  if(loading||!user)return <main className="shell"><p>{ui.loading}</p></main>;
  const audiences=[
    ['FRIENDS',ui.friends],['PUBLIC',ui.everyone],['FOLLOWERS',ui.followers],
    ['BEST_FRIENDS',ui.bestFriends],['PRIVATE',ui.onlyMe]
  ] as const;
  const durationText=(hours:number)=>hours<72?`${hours} h`:hours===72?'72 h':hours===168?(en?'7 days':'7 jours'):hours===336?(en?'14 days':'14 jours'):(en?'30 days':'30 jours');

  return <main className="shell km-story-editor">
    <header className="km-story-editor-header">
      <Link href="/feed" aria-label={ui.close} className="km-story-close">‹</Link>
      <div><span>@{user.username}</span><h1>{ui.createTitle}</h1></div>
      <button form="km-story-form" className="km-story-publish" type="submit" disabled={publishing}>
        {publishing?ui.publishing:(en?'Share':'Publier')}
      </button>
    </header>
    <form id="km-story-form" onSubmit={submit} className="km-story-editor-form">
      <div className="km-story-kinds" role="group" aria-label={en?'Story type':'Type de story'}>
        {(['TEXT','PHOTO','VIDEO','LINK'] as const).map(kind=><button key={kind}
          type="button" aria-pressed={type===kind} className={type===kind?'selected':''}
          onClick={()=>chooseType(kind)}>
          {kind==='TEXT'?ui.text:kind==='PHOTO'?(en?'Photo':'Photo'):kind==='VIDEO'?(en?'Video':'Vidéo'):ui.link}
        </button>)}
        <input ref={photoRef} type="file" hidden accept={PHOTO_MIMES.join(',')} onChange={e=>chooseFile(e,'PHOTO')}/>
        <input ref={videoRef} type="file" hidden accept={VIDEO_MIMES.join(',')} onChange={e=>chooseFile(e,'VIDEO')}/>
        <input ref={cameraRef} type="file" hidden accept="image/*" capture="environment" onChange={e=>chooseFile(e,'PHOTO')}/>
      </div>

      <div className="km-story-toolbar" role="group" aria-label={en?'Media tools':'Outils média'}>
        <button type="button" onClick={()=>photoRef.current?.click()} aria-label={en?'Choose photo':'Choisir une photo'}>
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m4 17 5-5 3 3 3-3 5 5"/><circle cx="9" cy="9" r="1.5"/></svg><span>{en?'Gallery':'Galerie'}</span>
        </button>
        <button type="button" onClick={()=>cameraRef.current?.click()} aria-label={en?'Take a photo':'Prendre une photo'}>
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="14" r="4"/></svg><span>{en?'Camera':'Caméra'}</span>
        </button>
        <button type="button" onClick={()=>videoRef.current?.click()} aria-label={en?'Choose a video':'Choisir une vidéo'}>
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg><span>{en?'Video':'Vidéo'}</span>
        </button>
      </div>
      <section className={`km-story-canvas km-story-canvas-${type.toLowerCase()}`} aria-label={en?'Story preview':'Aperçu de la story'}>
        {previewUrl&&type==='PHOTO'&&<img src={previewUrl} className="km-story-preview-image" alt=""/>}
        {previewUrl&&type==='VIDEO'&&<video controls playsInline muted src={previewUrl} className="km-story-preview-image"/>}
        {(type==='PHOTO'||type==='VIDEO')&&<button type="button" className="km-story-change-media"
          onClick={()=>chooseType(type)}>{en?'Change media':'Changer le média'}</button>}
        <textarea name="caption" rows={type==='TEXT'?4:2} maxLength={4000}
          placeholder={type==='TEXT'?ui.shareMoment:en?'Add a caption…':'Ajouter une légende…'}
          required={type==='TEXT'} />
        {type==='LINK'&&<input name="linkUrl" type="url" required placeholder="https://…" aria-label={ui.link}/>}
      </section>

      <section className="km-story-options">
        <label htmlFor="km-story-audience">{ui.audience}</label>
        <select id="km-story-audience" value={audience} onChange={e=>setAudience(e.target.value)}>
          {audiences.map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select>
        <label htmlFor="km-story-duration">{ui.duration}</label>
        <select id="km-story-duration" value={permanent?'PERMANENT':String(durationHours)}
          onChange={e=>{setPermanent(e.target.value==='PERMANENT');if(e.target.value!=='PERMANENT')setDurationHours(Number(e.target.value));}}>
          {DURATIONS.map(hours=><option key={hours} value={hours} disabled={hours!==24&&!premium}>
            {durationText(hours)}{hours!==24?' · Premium':''}
          </option>)}
          <option value="PERMANENT" disabled={!premium}>{en?'Permanent':'Permanent'} · Premium</option>
        </select>
      </section>
      <details className="km-story-advanced">
        <summary>{en?'More options':'Plus d’options'}</summary>
        <div className="km-story-advanced-body">
          <label><input type="checkbox" checked={allowReplies} onChange={e=>setAllowReplies(e.target.checked)}/>{ui.allowReplies}</label>
          <label><input type="checkbox" checked={allowReactions} onChange={e=>setAllowReactions(e.target.checked)}/>{ui.allowReactions}</label>
          <label><input type="checkbox" checked={allowSharing} onChange={e=>setAllowSharing(e.target.checked)}/>{ui.allowSharing}</label>
          <input name="hashtags" placeholder={en?'Hashtags (optional)':'Hashtags (facultatif)'} maxLength={300}/>
        </div>
      </details>
      {message&&<p role="alert" className="km-story-error">{message}</p>}
      <button type="submit" className="btn btn-primary km-story-bottom-submit" disabled={publishing}>
        {publishing?ui.publishing:ui.shareStory}
      </button>
    </form>
  </main>;
}
