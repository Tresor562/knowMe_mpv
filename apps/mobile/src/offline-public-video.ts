import * as FileSystem from 'expo-file-system';
import {API_URL} from './api';
import {publicPostVideoId,offlinePublicVideoFilename} from './offline-public-video-model';

const PUBLIC_BASE='https://31-56-85-53.sslip.io/knowme-api';

function videoPath(url:string) {
  const id=publicPostVideoId(url);
  if(!id||API_URL!==PUBLIC_BASE||!FileSystem.documentDirectory)
    throw Error('Cette vidéo ne peut pas être enregistrée hors ligne.');
  const root=FileSystem.documentDirectory+'knowme-offline-videos/';
  return {root,filename:offlinePublicVideoFilename(id),
    remote:PUBLIC_BASE+url};
}

/** Public media ONLY. Saved only on explicit user request, never in the background. */
export async function savedPublicVideo(url:string):Promise<string|null>{
  const {root,filename}=videoPath(url);
  const path=root+filename;
  const info=await FileSystem.getInfoAsync(path);
  return info.exists&&!info.isDirectory&&info.size>1024?path:null;
}

export async function deleteSavedPublicVideo(url:string):Promise<void>{
  const {root,filename}=videoPath(url);
  await FileSystem.deleteAsync(root+filename,{idempotent:true});
}

export async function downloadPublicVideoOffline(url:string,progress:(fraction:number)=>void,
    started?:(job:FileSystem.DownloadResumable)=>void):Promise<string>{
  const {root,filename,remote}=videoPath(url);
  await FileSystem.makeDirectoryAsync(root,{intermediates:true});
  const complete=root+filename;
  const existing=await savedPublicVideo(url);
  if(existing)return existing;
  const partial=root+filename+'.part';
  // Always start afresh after an interrupted download; do not mistake a
  // truncated .part file for a completed saved video.
  await FileSystem.deleteAsync(partial,{idempotent:true});
  const task=FileSystem.createDownloadResumable(remote,partial,{},
    ({totalBytesWritten,totalBytesExpectedToWrite})=>{
      if(totalBytesExpectedToWrite>0&&totalBytesWritten>=0)
        progress(Math.min(1,totalBytesWritten/totalBytesExpectedToWrite));
    });
  started?.(task);
  try{
    const result=await task.downloadAsync();
    if(!result||result.status!==200)
      throw Error('Téléchargement interrompu ou refusé par le serveur.');
    const info=await FileSystem.getInfoAsync(partial);
    if(!info.exists||info.isDirectory||info.size<=1024)
      throw Error('Le fichier reçu est incomplet.');
    const type=String(result.headers?.['content-type']??result.headers?.['Content-Type']??'')
      .split(';')[0]?.trim().toLowerCase();
    if(type&&type!=='video/mp4'&&type!=='application/octet-stream')
      throw Error('Le serveur a retourné un format inattendu.');
    await FileSystem.moveAsync({from:partial,to:complete});
    progress(1);
    return complete;
  }catch(error){
    await FileSystem.deleteAsync(partial,{idempotent:true}).catch(()=>undefined);
    throw error;
  }
}
