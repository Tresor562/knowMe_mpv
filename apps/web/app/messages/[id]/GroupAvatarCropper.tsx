'use client';

import {useEffect,useRef,useState} from 'react';
import {avatarCropFrame,type CropPan} from './group-avatar-crop';
import './group-avatar-cropper.css';

const SIDE=720;
const MAX_PIXELS=24_000_000;

export function GroupAvatarCropper({file,en,busy,error,onCancel,onApply}:{
  file:File;en:boolean;busy:boolean;error:string;
  onCancel:()=>void;onApply:(cropped:File)=>Promise<boolean>;
}){
  const tr=(fr:string,english:string)=>en?english:fr;
  const canvas=useRef<HTMLCanvasElement>(null);
  const cancel=useRef<HTMLButtonElement>(null);
  const dragging=useRef<{pointerId:number;x:number;y:number;pan:CropPan}|null>(null);
  const [image,setImage]=useState<HTMLImageElement|null>(null);
  const [zoom,setZoom]=useState(1);
  const [pan,setPan]=useState<CropPan>({x:0,y:0});
  const [issue,setIssue]=useState('');
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    let active=true;
    const url=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>{
      if(!active)return;
      if(!img.naturalWidth||!img.naturalHeight||
        img.naturalWidth*img.naturalHeight>MAX_PIXELS){
        setIssue(tr('Image trop grande ou illisible (maximum 24 mégapixels).',
          'Picture too large or unreadable (24 megapixels maximum).'));
        return;
      }
      setImage(img);
    };
    img.onerror=()=>{if(active)setIssue(tr('Impossible d’ouvrir cette image.','Could not open the picture.'));};
    img.src=url;
    return ()=>{active=false;URL.revokeObjectURL(url)};
  },[file,en]);

  useEffect(()=>{
    if(!image||!canvas.current)return;
    const context=canvas.current.getContext('2d');
    if(!context){setIssue(tr('Recadrage indisponible sur cet appareil.',
      'Crop editor unavailable on this device.'));return}
    const frame=avatarCropFrame(image.naturalWidth,image.naturalHeight,SIDE,zoom,pan);
    context.clearRect(0,0,SIDE,SIDE);
    context.fillStyle='#fff';
    context.fillRect(0,0,SIDE,SIDE);
    context.drawImage(image,frame.x,frame.y,frame.width,frame.height);
  },[image,zoom,pan,en]);

  useEffect(()=>{
    cancel.current?.focus();
    const handleKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!busy&&!saving){event.preventDefault();onCancel();}
      if(event.key==='Tab'){
        const root=cancel.current?.closest('[role="dialog"]');
        if(!root)return;
        const elements=Array.from(root.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),[tabindex="0"]'
        ));
        if(!elements.length)return;
        const first=elements[0],last=elements[elements.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',handleKey);
    return ()=>document.removeEventListener('keydown',handleKey);
  },[onCancel,busy,saving]);

  const move=(dx:number,dy:number)=>{
    if(!image)return;
    setPan(prev=>avatarCropFrame(image.naturalWidth,image.naturalHeight,SIDE,zoom,{
      x:prev.x+dx,y:prev.y+dy
    }).pan);
  };
  const stopDrag=()=>{dragging.current=null};
  async function apply(){
    const source=canvas.current;
    if(!image||!source||saving||busy)return;
    setSaving(true);setIssue('');
    try{
      const blob=await new Promise<Blob|null>(resolve=>source.toBlob(resolve,'image/jpeg',.9));
      if(!blob||blob.size<1024||blob.size>5*1024*1024){
        throw new Error(tr('Le recadrage ne produit pas une photo valide.','Cropping did not produce a valid image.'));
      }
      const name=file.name.replace(/\.[^/.]+$/,'').replace(/[^a-z0-9_-]/gi,'_').slice(0,75)||'groupe';
      await onApply(new File([blob],name+'-knowme.jpg',{type:'image/jpeg'}));
    }catch(cause){
      setIssue(cause instanceof Error?cause.message:tr('Recadrage impossible.','Could not crop image.'));
    }finally{setSaving(false)}
  }

  return <div className="km-avatar-crop-overlay" role="presentation">
    <section className="km-avatar-crop-dialog" role="dialog" aria-modal="true"
      aria-labelledby="km-avatar-crop-title" aria-describedby="km-avatar-crop-help">
      <header>
        <h3 id="km-avatar-crop-title">{tr('Recadrer la photo du groupe','Crop group photo')}</h3>
        <button ref={cancel} type="button" disabled={busy||saving} onClick={onCancel}
          aria-label={tr('Annuler','Cancel')}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M5 5 19 19M19 5 5 19"/></svg>
        </button>
      </header>
      <div className="km-avatar-crop-body">
        <div className="km-avatar-crop-stage" role="group" tabIndex={image?0:-1}
          aria-label={tr('Déplacer le recadrage avec les flèches du clavier ou glisser la photo',
            'Move crop with arrow keys or drag picture')}
          onKeyDown={event=>{
            if(!image)return;
            const step=event.shiftKey?30:9;
            const deltas:Record<string,[number,number]>={
              ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]
            };
            const delta=deltas[event.key];
            if(delta){event.preventDefault();move(delta[0],delta[1])}
          }}>
          <canvas ref={canvas} width={SIDE} height={SIDE}
            className="km-avatar-crop-canvas" aria-label={tr('Aperçu carré de la photo','Square photo preview')}
            onPointerDown={event=>{
              if(!image)return;
              event.currentTarget.setPointerCapture(event.pointerId);
              dragging.current={pointerId:event.pointerId,x:event.clientX,y:event.clientY,pan};
            }}
            onPointerMove={event=>{
              const state=dragging.current;
              if(!image||!state||state.pointerId!==event.pointerId)return;
              const ratio=SIDE/event.currentTarget.getBoundingClientRect().width;
              setPan(avatarCropFrame(image.naturalWidth,image.naturalHeight,SIDE,zoom,{
                x:state.pan.x+(event.clientX-state.x)*ratio,
                y:state.pan.y+(event.clientY-state.y)*ratio
              }).pan);
            }}
            onPointerUp={stopDrag} onPointerCancel={stopDrag}/>
          <span className="km-avatar-crop-ring" aria-hidden="true"/>
          {!image&&!issue&&<span className="km-avatar-crop-loading" role="status">
            {tr('Ouverture de la photo…','Opening picture…')}</span>}
        </div>
        <p id="km-avatar-crop-help">{tr('Glisse la photo pour la déplacer, puis règle le zoom. La photo sera enregistrée au format carré.',
          'Drag to position, then adjust zoom. Your picture will be saved as a square.')}</p>
        <label className="km-avatar-crop-zoom">
          <span>{tr('Zoom','Zoom')}</span>
          <input type="range" min="1" max="3" step="0.05" value={zoom}
            disabled={!image||busy||saving} onChange={event=>setZoom(Number(event.target.value))}
            aria-label={tr('Zoom de la photo','Picture zoom')}/>
          <output>{Math.round(zoom*100)} %</output>
        </label>
        {(issue||error)&&<p className="km-avatar-crop-error" role="alert">{issue||error}</p>}
      </div>
      <footer>
        <button type="button" disabled={busy||saving} onClick={onCancel}>
          {tr('Annuler','Cancel')}
        </button>
        <button type="button" disabled={!image||Boolean(issue)||busy||saving}
          className="km-avatar-crop-save" onClick={()=>void apply()}>
          {busy||saving?tr('Enregistrement…','Saving…'):tr('Enregistrer la photo','Save picture')}
        </button>
      </footer>
    </section>
  </div>;
}
