'use client';

import { useEffect, useMemo } from 'react';
import { checkPostFiles, publicPostAssetUrl, type PostMedia } from '../lib/post-media';

export function PostMediaStrip({postId,media}: {postId:string;media?:PostMedia[]}) {
  const attachments=(media??[]).filter(item=>item.asset.status!=='QUARANTINED'&&!item.asset.deletedAt);
  if(!attachments.length)return null;
  return <div style={{display:'flex',overflowX:'auto',gap:9,scrollSnapType:'x mandatory',padding:'6px 1px'}}
    role="group" aria-label="Médias de la publication">
    {attachments.map(({asset})=>{
      const url=publicPostAssetUrl(postId,asset.id);
      const isImage=asset.detectedMime.startsWith('image/');
      const isVideo=asset.detectedMime.startsWith('video/');
      const isAudio=asset.detectedMime.startsWith('audio/');
      return <div key={asset.id} style={{flex:'0 0 min(300px,85%)',scrollSnapAlign:'start',
        overflow:'hidden',borderRadius:19,border:'1px solid var(--soft-border)',background:'var(--surface-glass)'}}>
        {isImage?<a href={url} target="_blank" rel="noopener noreferrer" title={asset.originalName}>
          <img src={url} alt={asset.originalName} style={{width:'100%',height:240,objectFit:'contain'}}/>
        </a>:isVideo?<video controls preload="metadata" playsInline src={url}
          style={{width:'100%',height:240,background:'#050609'}}/>:
          <div style={{padding:18,display:'grid',gap:13,minHeight:100}}>
            <strong style={{wordBreak:'break-word'}}>{isAudio?'♫ ':'▤ '}{asset.originalName}</strong>
            {isAudio?<audio controls preload="none" src={url} style={{width:'100%'}}/>:
              <a href={url} download={asset.originalName} target="_blank" rel="noopener noreferrer"
                style={{color:'var(--mint)'}}>Ouvrir le document ↗</a>}
          </div>}
        <div style={{padding:'9px 12px',fontSize:12,color:'var(--muted)',overflow:'hidden',
          whiteSpace:'nowrap',textOverflow:'ellipsis'}} title={asset.originalName}>{asset.originalName}</div>
      </div>;
    })}
  </div>;
}

export function PostMediaPicker({files,onChange,maxCount=10}:{
  files:File[];onChange:(files:File[])=>void;maxCount?:number
}) {
  const previews=useMemo(()=>
    files.map(file=>({file,url:file.type.startsWith('image/')?URL.createObjectURL(file):null})),[files]);
  useEffect(()=>()=>{for(const item of previews)if(item.url)URL.revokeObjectURL(item.url);},[previews]);
  return <div style={{display:'grid',gap:10}}>
    <label style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
      <span style={{fontWeight:700}}>Galerie ou Fichiers</span>
      <input aria-label="Ajouter des photos, vidéos, musiques et documents"
        type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,audio/mpeg,audio/ogg,audio/wav,application/pdf"
        onChange={event=>{
          const chosen=Array.from(event.target.files??[]);
          const known=new Set(files.map(file=>file.name+':'+file.size+':'+file.lastModified));
          const merged=[...files,...chosen.filter(file=>!known.has(file.name+':'+file.size+':'+file.lastModified))];
          const message=checkPostFiles(merged,maxCount-files.length);
          if(message){event.target.setCustomValidity(message);event.target.reportValidity();
            event.target.value='';return;}
          event.target.setCustomValidity('');
          onChange(merged);event.target.value='';
        }}/>
    </label>
    <small style={{color:'var(--muted)'}}>Jusqu’à 10 médias · 25 Mo par fichier · analyse de sécurité avant publication.</small>
    {previews.length>0 && <div style={{display:'flex',overflowX:'auto',gap:9}}>
      {previews.map(({file,url},index)=><div key={file.name+index}
        style={{position:'relative',flex:'0 0 125px',border:'1px solid var(--soft-border)',
          borderRadius:14,overflow:'hidden',minHeight:140}}>
        {url?<img src={url} alt={file.name} style={{width:'100%',height:94,objectFit:'cover'}}/>:
          <div style={{height:94,display:'grid',placeItems:'center',fontSize:25}}>
            {file.type.startsWith('video/')?'▶':file.type.startsWith('audio/')?'♫':'▤'}
          </div>}
        <small title={file.name} style={{display:'block',padding:7,overflow:'hidden',
          whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{file.name}</small>
        <button type="button" onClick={()=>onChange(files.filter((_,i)=>i!==index))}
          aria-label={'Retirer '+file.name}
          style={{position:'absolute',right:3,top:3,width:28,height:28,borderRadius:'50%',
            border:0,background:'rgba(0,0,0,.7)',color:'#fff',cursor:'pointer'}}>×</button>
      </div>)}
    </div>}
  </div>;
}
