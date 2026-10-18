'use client';
import {useEffect,useState} from 'react';
import {getWebChatAudio,subscribeWebChatAudio,stopWebChatAudio,
 pauseWebChatAudio,resumeWebChatAudio,seekWebChatAudio} from './web-audio-session';

const fmt=(seconds:number)=>{
 const n=Math.max(0,Math.floor(seconds||0));
 return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;
};
export function ChatAudioMiniBar(){
 const [s,setS]=useState(getWebChatAudio);
 useEffect(()=>subscribeWebChatAudio(setS),[]);
 if(!s.assetId)return null;
 const progress=s.duration>0?Math.min(100,Math.max(0,s.position/s.duration*100)):0;
 const playing=s.phase==='playing';
 return <aside aria-label="Lecture audio persistante" style={{
   position:'sticky',top:0,zIndex:210,background:'#1d2933',color:'#e9edef',
   borderBottom:'1px solid #425561',padding:'5px 12px 0'
 }}>
   <div style={{display:'flex',alignItems:'center',gap:9,minHeight:42}}>
     <span aria-hidden="true" style={{fontSize:16}}>♫</span>
     <div style={{flex:1,minWidth:0,display:'grid',gap:2}}>
       <strong style={{fontSize:12,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.sender||'Message vocal'}</strong>
       <small style={{fontSize:10,color:'#acbfc8',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
         {s.source||'Conversation'} · {s.phase==='downloading'?'Téléchargement…':
         `${fmt(s.position)} / ${fmt(s.duration)}`}
       </small>
     </div>
     <button type="button" disabled={s.phase==='downloading'||s.phase==='error'}
       aria-label={playing?'Mettre en pause':'Reprendre le vocal'}
       onClick={()=>playing?pauseWebChatAudio():resumeWebChatAudio()}
       style={{width:44,height:44,background:'transparent',border:0,color:'inherit',cursor:'pointer'}}>
       {playing?<svg viewBox="0 0 24 24" width="23" height="23" stroke="currentColor" fill="none"
          strokeWidth="2.2" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>:
        <svg viewBox="0 0 24 24" width="23" height="23" fill="currentColor"
          aria-hidden="true"><path d="M8 4v16l13-8z"/></svg>}
     </button>
     <button type="button" aria-label="Arrêter complètement le vocal" onClick={stopWebChatAudio}
       style={{width:44,height:44,background:'transparent',border:0,color:'inherit',cursor:'pointer'}}>
       <svg viewBox="0 0 24 24" width="21" height="21" stroke="currentColor" fill="none"
         strokeWidth="2" aria-hidden="true"><path d="M5 5 19 19M19 5 5 19"/></svg>
     </button>
   </div>
   <input type="range" value={Math.min(s.duration||0,s.position)} max={Math.max(.1,s.duration)}
     min={0} step=".1" disabled={!s.downloaded}
     onChange={e=>seekWebChatAudio(Number(e.target.value))}
     aria-label="Position de lecture" style={{width:'100%',height:8,accentColor:'#53bdeb',margin:0}}/>
   {s.error?<div role="alert" style={{color:'#ffabb0',fontSize:11,paddingBottom:5}}>{s.error}</div>:null}
   <span className="sr-only">{Math.round(progress)} %</span>
 </aside>;
}
