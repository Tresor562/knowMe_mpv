import * as FileSystem from 'expo-file-system';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppearance } from './AppearanceProvider';

export type SelectedAndroidMedia = { uri: string; name: string; mime: string };
type Entry = SelectedAndroidMedia & { isDirectory: boolean };
const MIMES: Record<string, string> = {
  jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png',
  webp:'image/webp', gif:'image/gif', mp4:'video/mp4'
};
function nameFromUri(uri: string) {
  let value=uri;
  try {value=decodeURIComponent(uri)} catch {}
  return value.split(/[\\/:]/).pop() || 'fichier';
}
export function AndroidMediaLibraryPicker({ visible, allowVideo=false, onClose, onPicked }:{
  visible:boolean;
  allowVideo?:boolean;
  onClose:()=>void;
  onPicked:(media:SelectedAndroidMedia)=>void;
}) {
  const {colors}=useAppearance();
  const [entries,setEntries]=useState<Entry[]>([]);
  const [history,setHistory]=useState<string[]>([]);
  const [directory,setDirectory]=useState<string|null>(null);
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);

  async function readDirectory(uri:string) {
    setBusy(true);
    setNotice('');
    try {
      const raw=await FileSystem.StorageAccessFramework.readDirectoryAsync(uri);
      const next:Entry[]=[];
      for(let offset=0;offset<Math.min(raw.length,250);offset+=12) {
        const batch=raw.slice(offset,offset+12);
        const info=await Promise.all(batch.map(async candidate=>{
          const name=nameFromUri(candidate);
          const ext=name.split('.').pop()?.toLowerCase()||'';
          const metadata=await FileSystem.getInfoAsync(candidate).catch(()=>null);
          return {uri:candidate,name,isDirectory:Boolean(metadata?.exists&&metadata.isDirectory),
            mime:MIMES[ext]||''};
        }));
        next.push(...info);
      }
      setDirectory(uri);
      setEntries(next.filter(item=>item.isDirectory||Boolean(item.mime && (allowVideo||item.mime!=='video/mp4')))
        .sort((a,b)=>Number(b.isDirectory)-Number(a.isDirectory)||a.name.localeCompare(b.name)));
      if(raw.length>250)setNotice('250 premiers éléments affichés : ouvre un sous-dossier.');
    } catch(error) {setNotice(error instanceof Error?error.message:'Dossier inaccessible.');}
    finally {setBusy(false);}
  }

  useEffect(()=>{
    if(!visible)return;
    let active=true;
    setEntries([]);setHistory([]);setDirectory(null);
    if(Platform.OS!=='android') {
      setNotice('Le sélecteur est disponible sur Android.');
      return;
    }
    setBusy(true);
    void FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync()
      .then(result=>{
        if(!active)return;
        if(!result.granted){onClose();return;}
        void readDirectory(result.directoryUri);
      }).catch(error=>{
        if(active)setNotice(error instanceof Error?error.message:'Accès refusé aux fichiers.');
      }).finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;};
  },[visible,allowVideo]);

  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <View style={[styles.sheet,{backgroundColor:colors.surface,borderColor:colors.border}]}>
        <View style={styles.header}>
          <Text style={[styles.title,{color:colors.text}]}>Choisir un média</Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
            <Text style={{color:colors.accent,fontWeight:'700'}}>Fermer</Text>
          </Pressable>
        </View>
        <Text style={[styles.hint,{color:colors.muted}]}>Parcours tes dossiers, puis touche une photo{allowVideo?' ou une vidéo':''}.</Text>
        {notice?<Text style={{color:colors.danger}}>{notice}</Text>:null}
        {history.length? <Pressable accessibilityRole="button" style={styles.item}
          onPress={()=>{const parent=history[history.length-1];setHistory(x=>x.slice(0,-1));if(parent)void readDirectory(parent);}}>
          <Text style={{color:colors.accent}}>‹ Dossier précédent</Text>
        </Pressable>:null}
        {busy?<ActivityIndicator color={colors.accent}/>:null}
        <ScrollView style={styles.entries} keyboardShouldPersistTaps="handled">
          {entries.map(entry=><Pressable key={entry.uri} accessibilityRole="button"
            style={[styles.item,{borderColor:colors.border}]}
            onPress={()=>{
              if(entry.isDirectory){
                if(directory)setHistory(x=>[...x,directory]);
                void readDirectory(entry.uri);
              }else onPicked({uri:entry.uri,name:entry.name,mime:entry.mime});
            }}>
            <Text numberOfLines={2} style={{color:colors.text}}>{entry.isDirectory?'📁 ':'▧ '}{entry.name}</Text>
          </Pressable>)}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
const styles=StyleSheet.create({
  backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.62)'},
  sheet:{maxHeight:'83%',minHeight:320,borderTopLeftRadius:24,borderTopRightRadius:24,
    borderWidth:1,padding:18,gap:10},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  title:{fontSize:20,fontWeight:'800'},
  close:{minWidth:54,minHeight:44,justifyContent:'center',alignItems:'flex-end'},
  hint:{fontSize:13,lineHeight:19},
  entries:{flexGrow:0},
  item:{minHeight:48,paddingVertical:12,borderBottomWidth:StyleSheet.hairlineWidth}
});
