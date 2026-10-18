import * as FileSystem from 'expo-file-system';
import {API_URL,apiFetch,getAccessToken} from './api';
import {getKnowMeVoicePlaybackStatus,pauseKnowMeVoicePlayback,playKnowMeVoice,
 resumeKnowMeVoicePlayback,seekKnowMeVoicePlayback,stopKnowMeVoicePlayback} from './native-voice';

export type ChatAudioPhase='idle'|'downloading'|'ready'|'playing'|'paused'|'error';
export type ChatAudioState={
  assetId:string|null;ownerId:string|null;origin:string;sender:string;
  phase:ChatAudioPhase;positionMs:number;durationMs:number;
  downloadFraction:number|null;error:string|null;uri:string|null;
};
const EMPTY:ChatAudioState={assetId:null,ownerId:null,origin:'',sender:'',phase:'idle',
 positionMs:0,durationMs:0,downloadFraction:null,error:null,uri:null};
let state:ChatAudioState=EMPTY;
let generation=0;
let ticker:ReturnType<typeof setInterval>|null=null;
const listeners=new Set<(value:ChatAudioState)=>void>();
function update(next:Partial<ChatAudioState>){
 state={...state,...next};
 for(const listener of listeners)listener(state);
}
export function getChatAudioState(){return state;}
export function subscribeChatAudio(listener:(value:ChatAudioState)=>void){
 listeners.add(listener);listener(state);return()=>{listeners.delete(listener);};
}
function clearTicker(){if(ticker){clearInterval(ticker);ticker=null;}}
function startTicker(){
 clearTicker();
 ticker=setInterval(()=>{void (async()=>{
   try{
     const status=await getKnowMeVoicePlaybackStatus();
     if(!status||status.uri!==state.uri){await stopChatAudio();return;}
     if(status.playing){
       update({phase:'playing',positionMs:status.positionMs,durationMs:status.durationMs});
     }else if(state.phase==='playing'){
       // The native bridge releases the player on completion. Paused media
       // is never silently interpreted as stopped.
       await stopChatAudio();
     }
   }catch{await stopChatAudio();}
 })();},450);
}
export async function stopChatAudio(){
 generation++;clearTicker();
 update(EMPTY);
 await stopKnowMeVoicePlayback().catch(()=>undefined);
}
/** Explicit pause keeps the source, playhead and authenticated local download. */
export async function pauseChatAudio(){
 if(state.phase!=='playing')return;
 try{await pauseKnowMeVoicePlayback();clearTicker();update({phase:'paused'});}
 catch(error){update({error:error instanceof Error?error.message:'Pause indisponible'});}
}
export async function resumeChatAudio(){
 if(state.phase!=='paused')return;
 try{await resumeKnowMeVoicePlayback();update({phase:'playing',error:null});startTicker();}
 catch(error){update({error:error instanceof Error?error.message:'Reprise indisponible'});}
}
export async function seekChatAudio(positionMs:number){
 if(!state.uri||!['playing','paused'].includes(state.phase))return;
 try{
   const bounded=Math.round(Math.max(0,Math.min(state.durationMs,positionMs)));
   await seekKnowMeVoicePlayback(bounded);update({positionMs:bounded,error:null});
 }catch(error){update({error:error instanceof Error?error.message:'Recherche indisponible'});}
}
export async function toggleChatAudio(args:{
 assetId:string;ownerId:string;origin:string;sender:string;mimeType?:string;
}){
 if(state.assetId===args.assetId&&state.ownerId===args.ownerId){
   if(state.phase==='playing')return pauseChatAudio();
   if(state.phase==='paused')return resumeChatAudio();
   if(state.phase==='downloading')return;
 }
 await stopChatAudio();
 const myGeneration=++generation;
 update({...EMPTY,assetId:args.assetId,ownerId:args.ownerId,origin:args.origin,
   sender:args.sender,phase:'downloading'});
 try{
   // A fresh grant is mandatory even when a media file is present in cache.
   const grant=await apiFetch<{path:string}>(`/media/${encodeURIComponent(args.assetId)}/download-grant`,
     {method:'POST'});
   const expected=`/media/${encodeURIComponent(args.assetId)}/content?token=`;
   if(!grant.path.startsWith(expected))throw new Error('MEDIA_GRANT_PATH_INVALID');
   const token=await getAccessToken();
   if(!token||!FileSystem.cacheDirectory)throw new Error('SESSION_REQUIRED');
   const directory=FileSystem.cacheDirectory+'knowme-voice/';
   await FileSystem.makeDirectoryAsync(directory,{intermediates:true});
   const safeId=args.assetId.replace(/[^a-zA-Z0-9_-]/g,'');
   if(!safeId)throw new Error('AUDIO_INVALID_ID');
   const suffix=args.mimeType==='audio/mpeg'?'.mp3':args.mimeType==='audio/wav'?'.wav':'.ogg';
   const target=`${directory}attachment-${safeId}${suffix}`;
   const existing=await FileSystem.getInfoAsync(target);
   let uri=target;
   if(!existing.exists||!existing.size){
     const download=FileSystem.createDownloadResumable(`${API_URL}${grant.path}`,target,{
       headers:{Authorization:`Bearer ${token}`}
     },progress=>{
       if(generation!==myGeneration)return;
       const total=progress.totalBytesExpectedToWrite;
       update({downloadFraction:total>0?Math.min(1,progress.totalBytesWritten/total):null});
     });
     const result=await download.downloadAsync();
     if(!result||result.status!==200){
       await FileSystem.deleteAsync(target,{idempotent:true}).catch(()=>undefined);
       throw new Error('AUDIO_DOWNLOAD_FAILED');
     }
     uri=result.uri;
   }
   if(generation!==myGeneration)return;
   update({phase:'ready',uri,downloadFraction:1});
   await playKnowMeVoice(uri);
   if(generation!==myGeneration){
     await stopKnowMeVoicePlayback().catch(()=>undefined);
     return;
   }
   const status=await getKnowMeVoicePlaybackStatus();
   update({phase:'playing',uri,error:null,positionMs:status?.positionMs??0,
     durationMs:status?.durationMs??0});
   startTicker();
 }catch(error){
   if(generation===myGeneration){clearTicker();update({phase:'error',
     error:error instanceof Error?error.message:'Lecture impossible. Réessayer'});}
 }
}
/** Avoid displaying an old user's private audio when the authenticated owner switches. */
export async function requireChatAudioOwner(ownerId:string){
 if(state.ownerId&&state.ownerId!==ownerId)await stopChatAudio();
}
