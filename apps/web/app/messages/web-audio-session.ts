'use client';
import {apiFetch,apiFetchBlob} from '../../lib/api';

export type WebAudioPhase='idle'|'downloading'|'ready'|'playing'|'paused'|'error';
export type WebAudioSnapshot={
 assetId:string|null;source:string;sender:string;phase:WebAudioPhase;
 position:number;duration:number;error:string|null;downloaded:boolean;
};
const EMPTY:WebAudioSnapshot={assetId:null,source:'',sender:'',phase:'idle',
 position:0,duration:0,error:null,downloaded:false};
let state:WebAudioSnapshot=EMPTY;
let player:HTMLAudioElement|null=null;
let blobUrl:string|null=null;
let generation=0;
const subscribers=new Set<(s:WebAudioSnapshot)=>void>();
function publish(next:Partial<WebAudioSnapshot>){
 state={...state,...next};subscribers.forEach(fn=>fn(state));
}
export function getWebChatAudio(){return state;}
export function subscribeWebChatAudio(fn:(s:WebAudioSnapshot)=>void){
 subscribers.add(fn);fn(state);return()=>{subscribers.delete(fn);};
}
export function stopWebChatAudio(){
 generation++;
 if(player){player.pause();player.src='';player.load();player=null;}
 if(blobUrl){URL.revokeObjectURL(blobUrl);blobUrl=null;}
 publish(EMPTY);
}
export function toggleWebChatAudio(assetId:string,source:string,sender:string){
 if(state.assetId===assetId&&player){
   if(player.paused){void player.play().catch(()=>publish({phase:'error',error:'Lecture impossible.'}));}
   else player.pause();
   return;
 }
 void playNew(assetId,source,sender);
}
async function playNew(assetId:string,source:string,sender:string){
 stopWebChatAudio();
 const seq=++generation;
 publish({...EMPTY,assetId,source,sender,phase:'downloading'});
 try{
   const grant=await apiFetch<{path:string}>(`/media/${encodeURIComponent(assetId)}/download-grant`,
     {method:'POST'});
   const prefix=`/media/${encodeURIComponent(assetId)}/content?token=`;
   if(!grant.path.startsWith(prefix))throw new Error('MEDIA_GRANT_PATH_INVALID');
   const blob=await apiFetchBlob(grant.path);
   if(!['audio/mpeg','audio/ogg','audio/wav','audio/webm'].includes(blob.type))
     throw new Error('Format audio non pris en charge.');
   if(generation!==seq)return;
   blobUrl=URL.createObjectURL(blob);
   player=new Audio(blobUrl);
   player.preload='auto';
   player.addEventListener('loadedmetadata',()=>{
     if(generation===seq)publish({duration:Number.isFinite(player?.duration)?player!.duration:0});
   });
   player.addEventListener('timeupdate',()=>{if(generation===seq)publish({position:player?.currentTime??0});});
   player.addEventListener('play',()=>{if(generation===seq)publish({phase:'playing',error:null});});
   player.addEventListener('pause',()=>{if(generation===seq&&player?.ended===false)publish({phase:'paused'});});
   player.addEventListener('ended',()=>{if(generation===seq)stopWebChatAudio();});
   player.addEventListener('error',()=>{if(generation===seq)publish({phase:'error',error:'Audio indisponible.'});});
   publish({phase:'ready',downloaded:true});
   await player.play();
 }catch(error){
   if(generation===seq)publish({phase:'error',
     error:error instanceof Error?error.message:'Téléchargement audio impossible.'});
 }
}
export function seekWebChatAudio(seconds:number){
 if(!player||!Number.isFinite(player.duration)||player.duration<=0)return;
 player.currentTime=Math.max(0,Math.min(player.duration,seconds));
}
export function pauseWebChatAudio(){player?.pause();}
export function resumeWebChatAudio(){
 if(player)void player.play().catch(()=>publish({phase:'error',error:'Reprise impossible.'}));
}
