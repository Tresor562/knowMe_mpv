'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { apiFetch, apiFetchBlob } from '../../../lib/api';
import { knowMeConfirm } from '../../../components/knowme-feedback';
import { GroupAvatarCropper } from './GroupAvatarCropper';

const TYPES=['image/jpeg','image/png','image/webp'];
const MAX_BYTES=5*1024*1024;
type Capabilities={read:boolean;canEdit:boolean;maxBytes:number;allowedMime:string[]};
type UploadSession={id:string;uploadToken:string};
type UploadedAsset={id:string;status:string;scannerVerdict?:string};

export function GroupAvatarEditor({conversationId,title,canManage,en}:{
  conversationId:string;title:string;canManage:boolean;en:boolean
}){
  const tr=(fr:string,english:string)=>en?english:fr;
  const base=`/conversations/${encodeURIComponent(conversationId)}/group/avatar`;
  const [revision,setRevision]=useState(0);
  const [photo,setPhoto]=useState<string|null>(null);
  const [canEdit,setCanEdit]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [preview,setPreview]=useState(false);
  const picker=useRef<HTMLInputElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const avatarButton=useRef<HTMLButtonElement>(null);
  const closeRef=useRef<HTMLButtonElement>(null);

  useEffect(()=>{
    let alive=true;
    let objectUrl:string|null=null;
    setPhoto(null);
    setCanEdit(false);
    const load=async()=>{
      try{
        const capability=await apiFetch<Capabilities>(base+'/capabilities');
        if(!alive)return;
        setCanEdit(canManage && capability.canEdit);
        if(!capability.read)return;
        const blob=await apiFetchBlob(base);
        if(!alive)return;
        if(!TYPES.includes(blob.type)||blob.size>MAX_BYTES)return;
        objectUrl=URL.createObjectURL(blob);
        setPhoto(objectUrl);
      }catch(cause){
        if(!alive)return;
        // 404 means no saved picture. Other errors must not display a
        // fabricated photo or imply the viewer has extra permissions.
        if((cause as {status?:number})?.status!==404)
          setError(cause instanceof Error?cause.message:tr('Photo indisponible.','Photo unavailable.'));
      }
    };
    void load();
    return ()=>{alive=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[conversationId,revision,canManage,en]);

  function choosePhoto(event:ChangeEvent<HTMLInputElement>){
    const image=event.currentTarget.files?.[0];
    event.currentTarget.value='';
    if(!image||busy)return;
    setError('');setNotice('');
    if(!TYPES.includes(image.type)||image.size<1024||image.size>MAX_BYTES){
      setError(tr('Choisis une photo JPEG, PNG ou WebP entre 1 Ko et 5 Mo.',
        'Choose a JPEG, PNG or WebP picture between 1 KB and 5 MB.'));
      return;
    }
    setChosenPhoto(image);
  }

  async function uploadPicture(image:File):Promise<boolean>{
    if(busy)return false;
    setBusy(true);setError('');setNotice('');
    try{
      const caps=await apiFetch<Capabilities>(base+'/capabilities');
      if(!caps.canEdit)throw new Error(tr('Seuls les administrateurs peuvent changer cette photo.',
        'Only group admins can change this picture.'));
      const session=await apiFetch<UploadSession>('/media/uploads',{
        method:'POST',
        body:JSON.stringify({purpose:'AVATAR',visibility:'PRIVATE',maxBytes:MAX_BYTES,allowedMime:[image.type]})
      });
      const form=new FormData();
      form.append('file',image,image.name);
      const asset=await apiFetch<UploadedAsset>(`/media/uploads/${encodeURIComponent(session.id)}/complete`,{
        method:'POST',headers:{'x-upload-token':session.uploadToken},body:form
      });
      if(asset.status!=='AVAILABLE'||asset.scannerVerdict!=='CLEAN')
        throw new Error(tr('La vérification de sécurité de la photo a échoué.',
          'The picture did not pass the security scan.'));
      await apiFetch(base,{
        method:'PATCH',body:JSON.stringify({mediaAssetId:asset.id})
      });
      setRevision(v=>v+1);
      setNotice(tr('Photo du groupe enregistrée.','Group picture saved.'));
      return true;
    }catch(cause){
      setError(cause instanceof Error?cause.message:tr('Envoi de la photo impossible.',
        'Could not upload group picture.'));
      return false;
    }finally{setBusy(false)}
  }

  async function remove(){
    if(!canEdit||busy||!photo)return;
    if(!await knowMeConfirm(tr('Retirer la photo du groupe ?','Remove the group picture?')))return;
    setBusy(true);setError('');setNotice('');
    try{
      await apiFetch(base,{method:'DELETE'});
      setRevision(v=>v+1);
      setNotice(tr('Photo du groupe retirée.','Group picture removed.'));
    }catch(cause){
      setError(cause instanceof Error?cause.message:tr('Impossible de retirer la photo.',
        'Could not remove group picture.'));
    }finally{setBusy(false);}
  }

  useEffect(()=>{
    if(!preview)return;
    closeRef.current?.focus();
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){
        setPreview(false);
        avatarButton.current?.focus();
      }
      if(event.key==='Tab'){
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[preview]);

  return <div className="km-group-avatar-editor">
    <div className="km-group-avatar-frame">
      <button ref={avatarButton} className="km-info-group-avatar km-group-identity-mark" type="button"
        disabled={!photo}
        onClick={()=>setPreview(true)}
        aria-label={photo?tr('Voir la photo du groupe','View group picture'):
          tr('Avatar de groupe par défaut','Default group avatar')}>
        {photo?<img src={photo} alt="" />:
          <svg viewBox="0 0 44 44" width="42" height="42" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="17" cy="17" r="5.5"/><path d="M7.5 31.5c.7-6 4-8.7 9.5-8.7 5.3 0 8.8 2.7 9.5 8.7"/>
            <circle cx="30" cy="15.5" r="4"/><path d="M28.5 23c5.3-.7 8.1 2.2 8.5 7.5"/>
          </svg>}
      </button>
      {canEdit&&<button type="button" ref={trigger} disabled={busy}
        className="km-group-avatar-camera" onClick={()=>picker.current?.click()}
        aria-label={tr('Changer la photo du groupe','Change group picture')}
        title={tr('Changer la photo du groupe','Change group picture')}>
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8 5.5 9.8 3h4.4L16 5.5h3.5A1.5 1.5 0 0 1 21 7v12a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19V7a1.5 1.5 0 0 1 1.5-1.5z"/>
          <circle cx="12" cy="12.5" r="3.5"/>
        </svg>
      </button>}
      <input ref={picker} type="file" hidden accept={TYPES.join(',')}
        onChange={choosePhoto}
        aria-label={tr('Choisir une photo du groupe','Choose group picture')}/>
    </div>
    {canEdit&&photo&&<button type="button" className="km-group-avatar-remove"
      onClick={()=>void remove()} disabled={busy}>
      {tr('Retirer la photo','Remove picture')}
    </button>}
    {busy&&<p className="km-group-avatar-status" role="status">
      {tr('Enregistrement de la photo…','Saving picture…')}</p>}
    {notice&&<p className="km-group-avatar-status" role="status">{notice}</p>}
    {error&&<p className="km-group-avatar-error" role="alert">{error}</p>}
    {chosenPhoto&&<GroupAvatarCropper
      file={chosenPhoto} en={en} busy={busy} error={error}
      onCancel={()=>{setChosenPhoto(null);trigger.current?.focus();}}
      onApply={async cropped=>{
        const saved=await uploadPicture(cropped);
        if(saved){setChosenPhoto(null);trigger.current?.focus();}
        return saved;
      }}
    />}
    {preview&&photo&&<div className="km-group-avatar-preview" role="dialog" aria-modal="true"
      aria-label={tr('Photo du groupe','Group picture')} onClick={()=>{
        setPreview(false);avatarButton.current?.focus();
      }}>
      <div className="km-group-avatar-preview-inner" onClick={event=>event.stopPropagation()}>
        <button ref={closeRef} type="button" onClick={()=>{
          setPreview(false);avatarButton.current?.focus();
        }} aria-label={tr('Fermer','Close')}>×</button>
        <img src={photo} alt={title}/>
      </div>
    </div>}
  </div>;
}
