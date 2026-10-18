import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import {apiFetch} from './api';
import type {SelectedAndroidMedia} from './AndroidMediaLibraryPicker';
import {convertToKnowStickerWebp} from './native-gallery';
import {normalizeKnowStickerLabel,knowStickerUploadName} from './knowsticker-naming-model';
import {parseKnowStickerEmojiTags} from './knowsticker-emoji-tags';

const REGISTRY='knowme.knowsticker.local.packs.v1';
const FORMAT='KNOWSTICKER_V1';
const MAX_STICKER_SIZE=8*1024*1024;
export type KnowStickerItem={id:string;uri:string;name:string;mime:string;emojis?:string[]};
export type KnowStickerPack={id:string;name:string;createdAt:string;format:typeof FORMAT;
  archived?:boolean;items:KnowStickerItem[]};

function dir(){if(!FileSystem.documentDirectory)throw new Error('Stockage privé indisponible.');
  return FileSystem.documentDirectory+'knowsticker/';}
function safeId(){return 'ks-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);}
export async function readKnowStickerPacks():Promise<KnowStickerPack[]>{
  try{
    const raw=await AsyncStorage.getItem(REGISTRY);
    const data=JSON.parse(raw||'[]') as KnowStickerPack[];
    return Array.isArray(data)?data.filter(p=>p.format===FORMAT&&Array.isArray(p.items))
      .map(p=>({...p,archived:!!p.archived,items:p.items.map(item=>({
        ...item,emojis:Array.isArray(item.emojis)?item.emojis.filter((v):v is string=>typeof v==='string'):[]
      }))})):[];
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
      if(!file.mime.startsWith('image/'))
        throw new Error('Choisis des photos, pas des vidéos pour ce pack.');
      const converted=await convertToKnowStickerWebp(file.uri);
      try{
        const info=await FileSystem.getInfoAsync(converted);
        if(!info.exists||!info.size||info.size<100||info.size>MAX_STICKER_SIZE)
          throw new Error('Chaque sticker doit peser entre 100 octets et 8 Mo.');
        const uri=root+String(index).padStart(3,'0')+'.webp';
        await FileSystem.copyAsync({from:converted,to:uri});
        items.push({id:safeId(),uri,mime:'image/webp',name:file.name+'.webp'});
      }finally{
        await FileSystem.deleteAsync(converted,{idempotent:true}).catch(()=>undefined);
      }
    }
    const pack:KnowStickerPack={id,name:label,format:FORMAT,createdAt:new Date().toISOString(),items};
    // Persist the complete manifest before exposing the pack in the library;
    // interrupted conversions must not leave broken user-visible packs.
    await FileSystem.writeAsStringAsync(root+'manifest.knowsticker',JSON.stringify({
      format:FORMAT,version:1,id,name:label,
      files:items.map((item,index)=>({filename:item.uri.slice(root.length),name:item.name,
        mime:item.mime,index}))
    }));
    const existing=await readKnowStickerPacks();
    await writePacks([pack,...existing]);
    return pack;
  }catch(error){
    await FileSystem.deleteAsync(root,{idempotent:true}).catch(()=>undefined);
    throw error;
  }
}
/** Update both the private pack manifest and registry without changing file URIs. */
async function saveRenamedPack(previous:KnowStickerPack,updated:KnowStickerPack,packs:KnowStickerPack[]){
  if(!/^ks-[a-z0-9-]+$/.test(previous.id))throw new Error('Identifiant de pack invalide.');
  const path=dir()+previous.id+'/manifest.knowsticker';
  const oldManifest=await FileSystem.readAsStringAsync(path);
  const nextManifest=JSON.stringify({
    format:FORMAT,version:1,id:updated.id,name:updated.name,archived:!!updated.archived,
    files:updated.items.map((item,index)=>({
      filename:item.uri.slice((dir()+updated.id+'/').length),
      name:item.name,mime:item.mime,index,emojis:item.emojis??[]
    }))
  });
  await FileSystem.writeAsStringAsync(path,nextManifest);
  try{
    await writePacks(packs.map(pack=>pack.id===updated.id?updated:pack));
  }catch(error){
    await FileSystem.writeAsStringAsync(path,oldManifest).catch(()=>undefined);
    throw error;
  }
  return updated;
}

/** The renaming action edits only metadata. No re-encoding, external upload or file rename. */
export async function renameKnowStickerPack(id:string,input:string){
  const name=normalizeKnowStickerLabel(input);
  const packs=await readKnowStickerPacks();
  const old=packs.find(pack=>pack.id===id);
  if(!old)throw new Error('Pack KnowSticker introuvable.');
  if(old.name===name)return old;
  return saveRenamedPack(old,{...old,name},packs);
}
export async function renameKnowStickerItem(packId:string,itemId:string,input:string){
  const name=knowStickerUploadName(input);
  const packs=await readKnowStickerPacks();
  const old=packs.find(pack=>pack.id===packId);
  if(!old)throw new Error('Pack KnowSticker introuvable.');
  const item=old.items.find(value=>value.id===itemId);
  if(!item)throw new Error('Sticker introuvable dans ce pack.');
  if(item.name===name)return old;
  return saveRenamedPack(old,{
    ...old,items:old.items.map(value=>value.id===itemId?{...value,name}:value)
  },packs);
}

/** Archives hide a pack from the composer but never delete its WebP assets. */
export async function setKnowStickerPackArchived(id:string,archived:boolean){
  const packs=await readKnowStickerPacks();
  const pack=packs.find(p=>p.id===id);
  if(!pack)throw new Error('Pack introuvable.');
  return saveRenamedPack(pack,{...pack,archived},packs);
}
/** Persist the pack order without mutating its contents or URLs. */
export async function moveKnowStickerPack(id:string,direction:-1|1){
  const packs=await readKnowStickerPacks();
  const current=packs.findIndex(p=>p.id===id);
  if(current<0)throw new Error('Pack introuvable.');
  const next=current+direction;
  if(next<0||next>=packs.length)return packs;
  [packs[current],packs[next]]=[packs[next]!,packs[current]!];
  await writePacks(packs);
  return packs;
}
export async function setKnowStickerItemEmojis(packId:string,itemId:string,input:string){
  const emojis=parseKnowStickerEmojiTags(input);
  const packs=await readKnowStickerPacks();
  const pack=packs.find(p=>p.id===packId);
  if(!pack)throw new Error('Pack introuvable.');
  if(!pack.items.some(item=>item.id===itemId))throw new Error('Sticker introuvable.');
  return saveRenamedPack(pack,{...pack,items:pack.items.map(item=>
    item.id===itemId?{...item,emojis}:item)},packs);
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
