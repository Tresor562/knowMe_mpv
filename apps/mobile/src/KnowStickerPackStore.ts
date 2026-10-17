import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import {apiFetch} from './api';
import type {SelectedAndroidMedia} from './AndroidMediaLibraryPicker';

const REGISTRY='knowme.knowsticker.local.packs.v1';
const FORMAT='KNOWSTICKER_V1';
const MAX_STICKER_SIZE=8*1024*1024;
export type KnowStickerItem={id:string;uri:string;name:string;mime:string};
export type KnowStickerPack={id:string;name:string;createdAt:string;format:typeof FORMAT;
  items:KnowStickerItem[]};

function dir(){if(!FileSystem.documentDirectory)throw new Error('Stockage privé indisponible.');
  return FileSystem.documentDirectory+'knowsticker/';}
function safeId(){return 'ks-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);}
export async function readKnowStickerPacks():Promise<KnowStickerPack[]>{
  try{
    const raw=await AsyncStorage.getItem(REGISTRY);
    const data=JSON.parse(raw||'[]') as KnowStickerPack[];
    return Array.isArray(data)?data.filter(p=>p.format===FORMAT&&Array.isArray(p.items)):[];
  }catch{return [];}
}
async function writePacks(packs:KnowStickerPack[]){await AsyncStorage.setItem(REGISTRY,JSON.stringify(packs));}

/** A KnowSticker pack is app-private, owned by the person who created it.
 * Each file is still verified by the KnowMe server before it can be sent. */
export async function createKnowStickerPack(name:string,media:SelectedAndroidMedia[]) {
  const label=name.trim();
  if(label.length<1||label.length>80)throw new Error('Nom du pack : 1 à 80 caractères.');
  if(!media.length||media.length>120)throw new Error('Choisis entre 1 et 120 stickers.');
  const id=safeId(),root=dir()+id+'/';
  const items:KnowStickerItem[]=[];
  await FileSystem.makeDirectoryAsync(root,{intermediates:true});
  try{
    for(let index=0;index<media.length;index++){
      const file=media[index]!;
      if(!['image/webp','image/png'].includes(file.mime))
        throw new Error('Pour créer un sticker, choisis des images PNG ou WebP.');
      const info=await FileSystem.getInfoAsync(file.uri);
      if(!info.exists||!info.size||info.size<100||info.size>MAX_STICKER_SIZE)
        throw new Error('Chaque sticker doit peser entre 100 octets et 8 Mo.');
      const uri=root+String(index).padStart(3,'0')+(file.mime==='image/webp'?'.webp':'.png');
      await FileSystem.copyAsync({from:file.uri,to:uri});
      items.push({id:safeId(),uri,mime:file.mime,name:file.name});
    }
    const pack:KnowStickerPack={id,name:label,format:FORMAT,createdAt:new Date().toISOString(),items};
    const existing=await readKnowStickerPacks();
    await writePacks([pack,...existing]);
    // Portable format identifier; the on-device pack remains usable offline.
    await FileSystem.writeAsStringAsync(root+'manifest.knowsticker',JSON.stringify({
      format:FORMAT,version:1,id,name:label,
      files:items.map((item,index)=>({filename:item.uri.slice(root.length),name:item.name,
        mime:item.mime,index}))
    }));
    return pack;
  }catch(error){
    await FileSystem.deleteAsync(root,{idempotent:true}).catch(()=>undefined);
    throw error;
  }
}
export async function deleteKnowStickerPack(id:string){
  const packs=await readKnowStickerPacks();
  if(!packs.some(p=>p.id===id))return;
  await writePacks(packs.filter(p=>p.id!==id));
  if(/^ks-[a-z0-9-]+$/.test(id))
    await FileSystem.deleteAsync(dir()+id+'/',{idempotent:true}).catch(()=>undefined);
}
export async function sendKnowStickerImage<T>(conversationId:string,sticker:KnowStickerItem){
  if(!['image/png','image/webp'].includes(sticker.mime))throw new Error('Format sticker non pris en charge.');
  const info=await FileSystem.getInfoAsync(sticker.uri);
  if(!info.exists||!info.size||info.size>MAX_STICKER_SIZE)
    throw new Error('Le sticker n’est plus disponible.');
  const upload=await apiFetch<{id:string;uploadToken:string}>('/media/uploads',{
    method:'POST',body:JSON.stringify({purpose:'MESSAGE',visibility:'CONVERSATION',
      conversationId,maxBytes:info.size,allowedMime:[sticker.mime]})
  });
  const body=new FormData();
  body.append('file',{uri:sticker.uri,name:sticker.name,type:sticker.mime} as unknown as Blob);
  const asset=await apiFetch<{id:string;status:string}>(
    '/media/uploads/'+encodeURIComponent(upload.id)+'/complete',{
      method:'POST',headers:{'x-upload-token':upload.uploadToken},body
    });
  if(asset.status!=='AVAILABLE')throw new Error('Le contrôle du média a refusé le sticker.');
  return apiFetch<T>('/conversations/'+encodeURIComponent(conversationId)+'/media-messages',{
    method:'POST',body:JSON.stringify({assetId:asset.id,kind:'STICKER_IMAGE'})
  });
}
