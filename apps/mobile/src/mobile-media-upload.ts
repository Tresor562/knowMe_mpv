import * as FileSystem from 'expo-file-system';
import { apiFetch } from './api';
import { SelectedAndroidMedia } from './AndroidMediaLibraryPicker';

type UploadPurpose = 'AVATAR'|'COVER'|'STORY'|'POST';
type UploadSession = {id:string;uploadToken:string};
type Asset = {id:string;status:string;scannerVerdict?:string};

export async function uploadKnowMeMobileMedia(media:SelectedAndroidMedia,purpose:UploadPurpose) {
  const allowed=purpose==='AVATAR'||purpose==='COVER'
    ? ['image/jpeg','image/png','image/webp']
    : ['image/jpeg','image/png','image/webp','image/gif','video/mp4'];
  if(!allowed.includes(media.mime))throw new Error('Ce type de fichier n’est pas autorisé.');
  const maxBytes=(purpose==='AVATAR'||purpose==='COVER')?5*1024*1024:20*1024*1024;
  if(!FileSystem.cacheDirectory)throw new Error('Cache privé inaccessible.');
  const ext=media.name.split('.').pop()?.toLowerCase()||'bin';
  const temporary=`${FileSystem.cacheDirectory}knowme-upload-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  try {
    await FileSystem.copyAsync({from:media.uri,to:temporary});
    const info=await FileSystem.getInfoAsync(temporary);
    if(!info.exists||info.isDirectory||typeof info.size!=='number'||
      info.size<1024||info.size>maxBytes)
      throw new Error(`Le fichier doit peser entre 1 Ko et ${Math.round(maxBytes/1048576)} Mo.`);
    const session=await apiFetch<UploadSession>('/media/uploads',{
      method:'POST',
      body:JSON.stringify({purpose:purpose==='COVER'?'POST':purpose,visibility:'PRIVATE',maxBytes:info.size,allowedMime:[media.mime]})
    });
    const data=new FormData();
    data.append('file',{uri:temporary,name:media.name,type:media.mime} as unknown as Blob);
    const asset=await apiFetch<Asset>(`/media/uploads/${encodeURIComponent(session.id)}/complete`,{
      method:'POST',headers:{'x-upload-token':session.uploadToken},body:data
    });
    if(asset.status!=='AVAILABLE')
      throw new Error(asset.scannerVerdict==='UNAVAILABLE'
        ? 'Le contrôle de sécurité des médias est indisponible.'
        : 'Fichier rejeté par le contrôle de sécurité.');
    return asset.id;
  } finally {
    await FileSystem.deleteAsync(temporary,{idempotent:true}).catch(()=>undefined);
  }
}
