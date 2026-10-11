import { useState } from 'react';
import * as FileSystem from 'expo-file-system';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';

type MediaKind = 'GIF' | 'STICKER_IMAGE' | 'IMAGE';
type UploadResponse = { id:string; status:string };
type UploadSession = { id:string; uploadToken:string };
type DirectoryEntry = { uri:string; name:string; isDirectory:boolean; mime:string|null };

const MIMES: Record<string,string> = {
  gif:'image/gif',png:'image/png',webp:'image/webp',jpg:'image/jpeg',jpeg:'image/jpeg'
};

function fileNameFromUri(uri:string) {
  let decoded=uri;
  try { decoded=decodeURIComponent(uri); } catch { /* Keep the URI itself. */ }
  const path=decoded.split(/[\\/:]/);
  return path[path.length-1] || 'image';
}
function fileMime(uri:string) {
  const name=fileNameFromUri(uri).toLowerCase();
  return MIMES[name.split('.').pop()??''] ?? null;
}
function fileKind(mime:string): MediaKind {
  return mime==='image/gif'?'GIF':mime==='image/webp'||mime==='image/png'?'STICKER_IMAGE':'IMAGE';
}

export function ChatMediaPicker<T>({conversationId,onSent}:{
  conversationId:string;onSent:(message:T)=>void;
}) {
  const {colors}=useAppearance();
  const [visible,setVisible]=useState(false);
  const [directory,setDirectory]=useState<string|null>(null);
  const [entries,setEntries]=useState<DirectoryEntry[]>([]);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [preferSticker,setPreferSticker]=useState(false);

  async function readFolder(uri:string) {
    setBusy(true);
    setNotice('');
    try {
      const items=await FileSystem.StorageAccessFramework.readDirectoryAsync(uri);
      const files=await Promise.all(items.slice(0,250).map(async entry=>{
        const name=fileNameFromUri(entry);
        const info=await FileSystem.getInfoAsync(entry).catch(()=>null);
        return {uri:entry,name,isDirectory:info?.exists===true&&info.isDirectory,
          mime:fileMime(entry)} satisfies DirectoryEntry;
      }));
      setDirectory(uri);
      setEntries(files.filter(item=>item.isDirectory||item.mime!==null)
        .sort((a,b)=>Number(b.isDirectory)-Number(a.isDirectory)||a.name.localeCompare(b.name)));
      if(items.length>250)setNotice('250 premiers fichiers affichés. Choisis un dossier plus précis.');
    }catch(cause){
      setNotice(cause instanceof Error?cause.message:'Ce dossier est inaccessible.');
    }finally{setBusy(false);}
  }

  async function openPicker() {
    if(Platform.OS!=='android') {
      Alert.alert('Import de médias','Ce sélecteur utilise le système de fichiers Android.');
      return;
    }
    setVisible(true);
    setNotice('');
    setEntries([]);
    setDirectory(null);
    setBusy(true);
    try{
      // Android Storage Access Framework asks for an explicit directory permission.
      const result=await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if(result.granted)await readFolder(result.directoryUri);
      else setVisible(false);
    }catch(cause){
      setNotice(cause instanceof Error?cause.message:'Impossible d’ouvrir les fichiers.');
    }finally{setBusy(false);}
  }

  async function send(entry:DirectoryEntry) {
    if(!entry.mime||busy)return;
    const mime=entry.mime;
    const kind:MediaKind=mime==='image/png'||mime==='image/webp'
      ? (preferSticker?'STICKER_IMAGE':'IMAGE')
      : fileKind(mime);
    const limit=kind==='GIF'?15*1024*1024:kind==='STICKER_IMAGE'?8*1024*1024:20*1024*1024;
    const ext=entry.name.split('.').pop()?.toLowerCase()??'bin';
    const temp=`${FileSystem.cacheDirectory}knowme-chat-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    setBusy(true);setNotice('');
    try{
      // Copy the user-picked SAF document to a private app cache before multipart upload.
      await FileSystem.copyAsync({from:entry.uri,to:temp});
      const info=await FileSystem.getInfoAsync(temp);
      if(!info.exists||info.isDirectory||typeof info.size!=='number'||info.size<1024||info.size>limit)
        throw new Error(`Le fichier doit peser entre 1 Ko et ${Math.round(limit/1048576)} Mo.`);

      const session=await apiFetch<UploadSession>('/media/uploads',{
        method:'POST',
        body:JSON.stringify({purpose:'MESSAGE',visibility:'CONVERSATION',conversationId,
          maxBytes:info.size,allowedMime:[mime]})
      });
      const multipart=new FormData();
      multipart.append('file',{uri:temp,name:entry.name,type:mime} as unknown as Blob);
      const uploaded=await apiFetch<UploadResponse>(
        `/media/uploads/${encodeURIComponent(session.id)}/complete`,{
          method:'POST',headers:{'x-upload-token':session.uploadToken},body:multipart
        }
      );
      if(uploaded.status!=='AVAILABLE')
        throw new Error('Le contrôle de sécurité du fichier n’est pas validé. Envoi annulé.');
      const message=await apiFetch<T>(
        `/conversations/${encodeURIComponent(conversationId)}/media-messages`,{
          method:'POST',body:JSON.stringify({assetId:uploaded.id,kind})
        }
      );
      onSent(message);
      setVisible(false);
    }catch(cause){
      setNotice(cause instanceof Error?cause.message:'Le média n’a pas pu être envoyé.');
    }finally{
      await FileSystem.deleteAsync(temp,{idempotent:true}).catch(()=>undefined);
      setBusy(false);
    }
  }

  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Envoyer un GIF, un sticker ou une photo"
      onPress={()=>void openPicker()} style={[styles.trigger,{backgroundColor:colors.backgroundAccent}]}>
      <Text style={[styles.triggerText,{color:colors.text}]}>＋</Text>
    </Pressable>
    <Modal visible={visible} animationType="slide" transparent onRequestClose={()=>{if(!busy)setVisible(false);}}>
      <View style={styles.shade}>
        <View style={[styles.sheet,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          <View style={styles.heading}>
            <Text style={[styles.title,{color:colors.text}]}>GIFs · Stickers · Photos</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Fermer"
              disabled={busy} onPress={()=>setVisible(false)} style={styles.close}>
              <Text style={[styles.label,{color:colors.text}]}>Fermer</Text>
            </Pressable>
          </View>
          <Text style={[styles.help,{color:colors.muted}]}>
            Sélectionne un dossier, puis touche un fichier image pour l’envoyer en privé.
          </Text>
          <Pressable accessibilityRole="checkbox" accessibilityState={{checked:preferSticker}}
            onPress={()=>setPreferSticker(value=>!value)} style={styles.option}>
            <Text style={[styles.label,{color:colors.text}]}>
              {preferSticker?'☑':'☐'} Envoyer les PNG/WebP comme stickers
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={()=>void openPicker()} style={styles.option}>
            <Text style={[styles.label,{color:colors.accent}]}>Changer de dossier</Text>
          </Pressable>
          {busy&&<Text style={[styles.help,{color:colors.muted}]}>Traitement en cours…</Text>}
          {!!notice&&<Text accessibilityRole="alert" style={[styles.help,{color:colors.text}]}>{notice}</Text>}
          <ScrollView style={styles.files} contentContainerStyle={styles.fileContent}>
            {directory&&entries.length===0&&!busy&&<Text style={[styles.help,{color:colors.muted}]}>Aucun GIF, WebP, PNG ou JPEG dans ce dossier.</Text>}
            {entries.map(file=><Pressable key={file.uri} accessibilityRole="button" disabled={busy}
              style={[styles.file,{borderBottomColor:colors.border}]}
              onPress={()=>{if(file.isDirectory)void readFolder(file.uri);else void send(file);}}>
              <Text style={[styles.fileText,{color:colors.text}]} numberOfLines={1}>
                {file.isDirectory?'📁':'▧'} {file.name}
              </Text>
              <Text style={[styles.help,{color:colors.muted}]}>{file.isDirectory?'Ouvrir':'Envoyer'}</Text>
            </Pressable>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}
const styles=StyleSheet.create({
  trigger:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center'},
  triggerText:{fontSize:27,fontWeight:'500'},
  shade:{flex:1,backgroundColor:'rgba(0,0,0,.55)',justifyContent:'flex-end'},
  sheet:{maxHeight:'84%',minHeight:340,borderWidth:1,borderTopLeftRadius:26,borderTopRightRadius:26,
    paddingHorizontal:15,paddingVertical:13,paddingBottom:30},
  heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},
  title:{fontSize:18,fontWeight:'700',flex:1},
  close:{minHeight:44,justifyContent:'center',paddingHorizontal:10},
  label:{fontSize:13,fontWeight:'600'},
  help:{fontSize:12,lineHeight:18,marginVertical:5},
  option:{minHeight:44,justifyContent:'center'},
  files:{maxHeight:400},
  fileContent:{paddingBottom:25},
  file:{minHeight:55,borderBottomWidth:1,flexDirection:'row',alignItems:'center',gap:9},
  fileText:{flex:1,fontSize:13}
});
