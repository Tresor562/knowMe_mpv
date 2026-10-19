'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { apiFetch, apiFetchBlob } from '../../../lib/api';
import { knowMeConfirm } from '../../../components/knowme-feedback';
import { computeAvatarCrop, GROUP_AVATAR_PREVIEW_SIZE, GROUP_AVATAR_OUTPUT_SIZE } from './group-avatar-crop';

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
  const [cropUrl,setCropUrl]=useState<string|null>(null);
  const [cropMime,setCropMime]=useState('image/jpeg');
  const [dimensions,setDimensions]=useState<{width:number;height:number}|null>(null);
  const [zoom,setZoom]=useState(1);
  const [pan,setPan]=useState({x:0,y:0});
  const drag=useRef<{x:number;y:number;panX:number;panY:number}|null>(null);
  const cropImage=useRef<HTMLImageElement>(null);
  const cropDialog=useRef<HTMLDivElement>(null);
  const cropClose=useRef<HTMLButtonElement>(null);
  const picker=useRef<HTMLInputElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const avatarButton=useRef<HTMLButtonElement>(null);
  const closeRef=useRef<HTMLButtonElement>(null);

  useEffect(()=>()=>{if(cropUrl)URL.revokeObjectURL(cropUrl);},[cropUrl]);

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

  function closeCrop(){
    if(busy)return;
    setCropUrl(null);
    setDimensions(null);
    drag.current=null;
    trigger.current?.focus();
  }

  function chooseImage(event:ChangeEvent<HTMLInputElement>){
    const image=event.currentTarget.files?.[0];
    event.currentTarget.value='';
    if(!image||busy||!canEdit)return;
    if(!TYPES.includes(image.type)||image.size<1024||image.size>MAX_BYTES){
      setError(tr('Choisis une photo JPEG, PNG ou WebP entre 1 Ko et 5 Mo.',
        'Choose a JPEG, PNG or WebP picture between 1 KB and 5 MB.'));
      return;
    }
    setError('');setNotice('');setCropMime(image.type);
    setDimensions(null);setZoom(1);setPan({x:0,y:0});
    setCropUrl(URL.createObjectURL(image));
  }

  const crop=dimensions?computeAvatarCrop(dimensions.width,dimensions.height,zoom,pan.x,pan.y):null;

  function moveCrop(x:number,y:number){
    if(!dimensions)return;
    const next=computeAvatarCrop(dimensions.width,dimensions.height,zoom,x,y);
    setPan({x:next.panX,y:next.panY});
  }

  function changeZoom(nextZoom:number){
    if(!dimensions)return;
    const next=computeAvatarCrop(dimensions.width,dimensions.height,nextZoom,pan.x,pan.y);
    setZoom(next.zoom);
    setPan({x:next.panX,y:next.panY});
  }

  async function saveCrop(){
    if(!cropUrl||!cropImage.current||!dimensions||!crop||busy||!canEdit)return;
    setBusy(true);setError('');setNotice('');
    try {
      const canvas=document.createElement('canvas');
      canvas.width=GROUP_AVATAR_OUTPUT_SIZE;
      canvas.height=GROUP_AVATAR_OUTPUT_SIZE;
      const context=canvas.getContext('2d');
      if(!context)throw new Error(tr('Recadrage non disponible sur cet appareil.','Cropping is unavailable on this device.'));
      context.imageSmoothingEnabled=true;
      context.imageSmoothingQuality='high';
      if(cropMime==='image/jpeg'){
        context.fillStyle='#ffffff';
        context.fillRect(0,0,canvas.width,canvas.height);
      }
      context.drawImage(cropImage.current,
        crop.sourceX,crop.sourceY,crop.sourceSize,crop.sourceSize,
        0,0,canvas.width,canvas.height);
      const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,cropMime,0.92));
      if(!blob||!TYPES.includes(blob.type)||blob.size<1024||blob.size>MAX_BYTES)
        throw new Error(tr('La photo recadrée ne respecte pas la limite de 5 Mo.',
          'The cropped picture exceeds the 5 MB limit or is invalid.'));
      const caps=await apiFetch<Capabilities>(base+'/capabilities');
      if(!caps.canEdit)throw new Error(tr('Seuls les administrateurs peuvent changer cette photo.',
        'Only group admins can change this picture.'));
      const session=await apiFetch<UploadSession>('/media/uploads',{
        method:'POST',
        body:JSON.stringify({purpose:'AVATAR',visibility:'PRIVATE',maxBytes:MAX_BYTES,allowedMime:[blob.type]})
      });
      const extension=blob.type==='image/png'?'png':blob.type==='image/webp'?'webp':'jpg';
      const form=new FormData();
      form.append('file',blob,`group-avatar.${extension}`);
      const asset=await apiFetch<UploadedAsset>(
        `/media/uploads/${encodeURIComponent(session.id)}/complete`,{
          method:'POST',headers:{'x-upload-token':session.uploadToken},body:form
        });
      if(asset.status!=='AVAILABLE'||asset.scannerVerdict!=='CLEAN')
        throw new Error(tr('La vérification de sécurité de la photo a échoué.',
          'The picture did not pass the security scan.'));
      await apiFetch(base,{method:'PATCH',body:JSON.stringify({mediaAssetId:asset.id})});
      setCropUrl(null);setDimensions(null);drag.current=null;
      setRevision(value=>value+1);
      setNotice(tr('Photo du groupe enregistrée.','Group picture saved.'));
      trigger.current?.focus();
    }catch(cause){
      setError(cause instanceof Error?cause.message:tr('Envoi de la photo impossible.',
        'Could not upload group picture.'));
    }finally{setBusy(false);}
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

  useEffect(()=>{
    if(!cropUrl)return;
    cropClose.current?.focus();
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){
        if(!busy){
          event.preventDefault();
          setCropUrl(null);
          setDimensions(null);
          drag.current=null;
          trigger.current?.focus();
        }
        return;
      }
      if(event.key!=='Tab'||!cropDialog.current)return;
      const focusable=[...cropDialog.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),[tabindex="0"]'
      )].filter(item=>item.getClientRects().length>0);
      if(!focusable.length)return;
      const current=focusable.indexOf(document.activeElement as HTMLElement);
      if(event.shiftKey&&(current===0||current<0)){
        event.preventDefault();
        focusable[focusable.length-1].focus();
      }else if(!event.shiftKey&&current===focusable.length-1){
        event.preventDefault();
        focusable[0].focus();
      }
    };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[cropUrl,busy]);

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
        onChange={chooseImage}
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
    {cropUrl&&<div ref={cropDialog} className="km-group-avatar-crop-backdrop" role="dialog"
      aria-modal="true" aria-label={tr('Recadrer la photo du groupe','Crop group picture')}
      aria-describedby="km-group-crop-help">
      <div className="km-group-avatar-crop-panel">
        <header className="km-group-crop-header">
          <button ref={cropClose} type="button" onClick={closeCrop}
            disabled={busy} aria-label={tr('Annuler le recadrage','Cancel crop')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" width="22" height="22" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
          <h3>{tr('Recadrer la photo','Crop picture')}</h3>
          <button type="button" disabled={!crop||busy} onClick={()=>void saveCrop()}
            className="km-group-crop-save">
            {busy?tr('Enregistrement…','Saving…'):tr('Terminé','Done')}
          </button>
        </header>
        <div className="km-group-crop-body">
          <p id="km-group-crop-help">
            {tr('Glisse la photo pour la déplacer. Utilise le zoom ou les flèches du clavier.',
              'Drag the picture to move it. Use zoom or the arrow keys.')}
          </p>
          <div className="km-group-crop-viewport" tabIndex={0}
            role="img" aria-label={tr('Photo à recadrer, déplaçable avec les flèches',
              'Crop picture, use arrow keys to move')}
            onPointerDown={event=>{
              if(!crop||busy||(event.pointerType==='mouse'&&event.button!==0))return;
              drag.current={x:event.clientX,y:event.clientY,
                panX:crop.panX,panY:crop.panY};
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={event=>{
              if(!drag.current||busy)return;
              moveCrop(drag.current.panX+event.clientX-drag.current.x,
                drag.current.panY+event.clientY-drag.current.y);
            }}
            onPointerUp={()=>{drag.current=null;}}
            onPointerCancel={()=>{drag.current=null;}}
            onKeyDown={event=>{
              if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)||busy)return;
              event.preventDefault();
              const delta=event.shiftKey?18:6;
              moveCrop(pan.x+(event.key==='ArrowLeft'?delta:event.key==='ArrowRight'?-delta:0),
                pan.y+(event.key==='ArrowUp'?delta:event.key==='ArrowDown'?-delta:0));
            }}>
            <img src={cropUrl} ref={cropImage} alt="" draggable={false}
              style={crop?{left:crop.left,top:crop.top,
                width:crop.cssWidth,height:crop.cssHeight}:undefined}
              onLoad={event=>{
                const w=event.currentTarget.naturalWidth,h=event.currentTarget.naturalHeight;
                if(!w||!h||w>8192||h>8192||w*h>36000000){
                  setDimensions(null);
                  setError(tr('Image trop grande ou illisible. Choisis une autre photo.',
                    'Picture is too large or unreadable. Choose a different one.'));
                  return;
                }
                setDimensions({width:w,height:h});
              }}
              onError={()=>{
                setDimensions(null);
                setError(tr('Impossible de lire cette photo. Choisis une autre image.',
                  'Could not read this picture. Choose a different image.'));
              }}/>
            <span className="km-group-crop-outline" aria-hidden="true"/>
          </div>
          <div className="km-group-crop-zoom">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none"
              strokeWidth="1.8" aria-hidden="true"><circle cx="10" cy="10" r="6"/>
              <path d="m14.5 14.5 5 5M7.5 10h5"/></svg>
            <label htmlFor="km-group-photo-zoom">{tr('Zoom','Zoom')}</label>
            <input id="km-group-photo-zoom" type="range" min="1" max="3" step="0.05"
              value={zoom} disabled={!dimensions||busy}
              onChange={event=>changeZoom(Number(event.target.value))}
              aria-label={tr('Agrandir ou réduire la photo','Zoom group picture')}/>
            <output htmlFor="km-group-photo-zoom">{zoom.toFixed(2)}×</output>
          </div>
          <button type="button" className="km-group-crop-reset" disabled={!dimensions||busy}
            onClick={()=>{setZoom(1);setPan({x:0,y:0});}}>
            {tr('Recentrer','Reset position')}
          </button>
          {error&&<p className="km-group-avatar-error" role="alert">{error}</p>}
          {busy&&<p className="km-group-avatar-status" role="status">
            {tr('Enregistrement de la photo recadrée…','Saving cropped picture…')}</p>}
        </div>
      </div>
    </div>}
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
