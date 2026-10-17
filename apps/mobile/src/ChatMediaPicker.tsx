import { useEffect, useState, type ReactNode } from 'react';
import * as FileSystem from 'expo-file-system';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { KnowMeAlert as Alert } from './ui/KnowMeFeedback';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';
import { useI18n } from './I18nProvider';
import { AndroidMediaLibraryPicker, type SelectedAndroidMedia } from './AndroidMediaLibraryPicker';
import { openKnowMeFiles, type SelectedKnowMeFile } from './native-gallery';
import { KnowMeIcon } from './ui/KnowMeUI';
import {KnowMeVoiceComposer} from './KnowMeVoiceComposer';

type MediaKind = 'GIF' | 'STICKER_IMAGE' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
type UploadSession = { id: string; uploadToken: string };
type UploadResponse = { id: string; status: string; scannerVerdict?: string };

const SUPPORTED = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4',
  'audio/mpeg', 'audio/ogg', 'audio/wav', 'application/pdf'
]);

function detectKind(mime: string, preferSticker: boolean): MediaKind {
  if (mime === 'image/gif') return 'GIF';
  if (mime === 'image/png' || mime === 'image/webp') return preferSticker ? 'STICKER_IMAGE' : 'IMAGE';
  if (mime.startsWith('image/')) return 'IMAGE';
  if (mime === 'video/mp4') return 'VIDEO';
  if (mime.startsWith('audio/')) return 'AUDIO';
  return 'DOCUMENT';
}

export function ChatMediaPicker<T>({conversationId,onSent,showVoice=true,referenceChat=false,inputSlot,gifGalleryRequest=0,
  expressionOpen=false,expressionExpanded=false,onToggleExpression}:{
  conversationId:string;onSent:(message:T)=>void;showVoice?:boolean;
  referenceChat?:boolean;inputSlot?:ReactNode;gifGalleryRequest?:number;
  expressionOpen?:boolean;expressionExpanded?:boolean;onToggleExpression?:()=>void;
}) {
  const { colors } = useAppearance();
  const { locale } = useI18n();
  const en = locale === 'en';
  const [menuVisible,setMenuVisible] = useState(false);
  const [galleryVisible,setGalleryVisible] = useState(false);
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState('');
  const [progress,setProgress] = useState('');
  const [preferSticker,setPreferSticker] = useState(false);
  useEffect(()=>{
    // Only user-triggered requests open the native picker, never the initial render.
    if(gifGalleryRequest>0&&!busy)setGalleryVisible(true);
  },[gifGalleryRequest]);

  async function uploadOne(file: SelectedKnowMeFile): Promise<T> {
    const mime = file.mime.toLowerCase();
    if (!SUPPORTED.has(mime)) {
      throw new Error(en
        ? 'This file type is not supported by the current media server.'
        : 'Le serveur multimédia actuel ne prend pas encore en charge ce type de fichier.');
    }
    const kind = detectKind(mime, preferSticker);
    const limit = kind === 'GIF' ? 15 * 1048576 : kind === 'STICKER_IMAGE' ? 8 * 1048576 : 20 * 1048576;
    if (!FileSystem.cacheDirectory) throw new Error('Cache privé du téléphone indisponible.');
    const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    const temporary = FileSystem.cacheDirectory + 'knowme-send-' + Date.now() + '-'
      + Math.random().toString(36).slice(2) + '.' + ext;
    try {
      await FileSystem.copyAsync({ from:file.uri, to:temporary });
      const info = await FileSystem.getInfoAsync(temporary);
      if (!info.exists || info.isDirectory || !info.size || info.size < 1024 || info.size > limit) {
        throw new Error(en ? 'File must be between 1KB and ' + Math.round(limit / 1048576) + 'MB.'
          : 'Fichier autorisé : entre 1 Ko et ' + Math.round(limit / 1048576) + ' Mo.');
      }
      const session = await apiFetch<UploadSession>('/media/uploads', {
        method:'POST',
        body:JSON.stringify({
          purpose:'MESSAGE',visibility:'CONVERSATION',conversationId,
          maxBytes:info.size,allowedMime:[mime]
        })
      });
      const body = new FormData();
      body.append('file',{uri:temporary,name:file.name,type:mime} as unknown as Blob);
      const asset = await apiFetch<UploadResponse>(
        '/media/uploads/' + encodeURIComponent(session.id) + '/complete',{
          method:'POST', headers:{'x-upload-token':session.uploadToken}, body
        }
      );
      if (asset.status !== 'AVAILABLE') {
        throw new Error(asset.scannerVerdict === 'UNAVAILABLE'
          ? 'Contrôle de sécurité indisponible. Envoi annulé.'
          : 'Le fichier a été refusé par le contrôle de sécurité.');
      }
      return apiFetch<T>('/conversations/' + encodeURIComponent(conversationId) + '/media-messages',{
        method:'POST',body:JSON.stringify({assetId:asset.id,kind})
      });
    } finally {
      await FileSystem.deleteAsync(temporary,{idempotent:true}).catch(()=>undefined);
    }
  }

  async function sendFiles(files: SelectedKnowMeFile[] | SelectedAndroidMedia[]): Promise<boolean> {
    if(busy||!files.length)return false;
    setMenuVisible(false);setGalleryVisible(false);setBusy(true);setNotice('');
    let delivered=0;
    const errors:string[]=[];
    try{
      // Bound active uploads to one at a time; do not load a potentially huge
      // media selection into memory or fail the whole batch for one bad item.
      for(let index=0;index<files.length;index++){
        const file=files[index];
        if(!file)continue;
        setProgress(`${index+1}/${files.length} · ${delivered} envoyé(s)`);
        try{
          const message=await uploadOne(file);
          onSent(message);
          delivered++;
        }catch(cause){
          const reason=cause instanceof Error?cause.message:'Échec du transfert.';
          errors.push(`${file.name}: ${reason}`);
        }
      }
      if(errors.length){
        const summary=`${delivered}/${files.length} envoyé(s). ${errors.length} échec(s).`;
        setNotice(summary);
        Alert.alert('Transfert partiel',summary+'\n'+errors.slice(0,3).join('\n'));
      }
      return delivered===files.length;
    }finally{
      setBusy(false);
      setProgress('');
    }
  }

  async function chooseFiles() {
    if (busy) return;
    setMenuVisible(false);
    try {
      const picked = await openKnowMeFiles(true);
      if (picked.length) await sendFiles(picked);
    } catch (cause) {
      Alert.alert(en ? 'Files unavailable' : 'Fichiers indisponibles',
        cause instanceof Error ? cause.message : 'Réessaie.');
    }
  }

  return <>
    <View style={referenceChat?styles.referenceRow:styles.recordAndAttach}>
      {referenceChat ? <View style={styles.referencePill}>
        {inputSlot}
        <Pressable accessibilityRole="button"
          accessibilityLabel={en ? 'Attach files' : 'Joindre des fichiers'}
          disabled={busy} onPress={()=>setMenuVisible(true)} style={styles.referenceTrigger}>
          {busy?<ActivityIndicator color="#aebac1" size="small"/>:<KnowMeIcon name="paperclip" size={23} color="#aebac1"/>}
        </Pressable>
        {expressionOpen?<Pressable accessibilityRole="button"
          accessibilityLabel={expressionExpanded?'Réduire le clavier multimédia':'Agrandir le clavier multimédia'}
          onPress={onToggleExpression} style={styles.referenceTrigger}>
          <KnowMeIcon name={expressionExpanded?'chevron-down':'chevron-up'} size={24} color="#aebac1"/>
        </Pressable>:
        <Pressable accessibilityRole="button" accessibilityLabel={en?'Open media gallery':'Ouvrir la galerie KnowMe'}
          disabled={busy} onPress={()=>setGalleryVisible(true)} style={styles.referenceTrigger}>
          <KnowMeIcon name="camera" size={23} color="#aebac1"/>
        </Pressable>}
      </View> : <Pressable accessibilityRole="button"
        accessibilityLabel={en ? 'Attach photos, videos or files' : 'Joindre photos, vidéos ou fichiers'}
        disabled={busy}
        onPress={()=>setMenuVisible(true)}
        style={[styles.trigger,{backgroundColor:colors.backgroundAccent}]}>
        {busy ? <ActivityIndicator color={colors.accent} size="small"/> :
          <KnowMeIcon name="create" size={24} color={colors.text}/>}
      </Pressable>}
      {showVoice ? <KnowMeVoiceComposer busy={busy} referenceChat={referenceChat} onSend={file=>sendFiles([file])}/> : null}
    </View>
    {!!progress && <Text style={[styles.progress,{color:colors.muted}]}>{progress}</Text>}
    {!!notice && !busy && <Pressable onPress={()=>setMenuVisible(true)}>
      <Text numberOfLines={2} style={[styles.notice,{color:colors.danger}]}>{notice}</Text>
    </Pressable>}
    <Modal visible={menuVisible} transparent animationType="fade"
      onRequestClose={()=>setMenuVisible(false)}>
      <Pressable style={styles.scrim} onPress={()=>setMenuVisible(false)}>
        <Pressable style={[styles.sheet,{backgroundColor:referenceChat?'#202c33':colors.surface,borderColor:referenceChat?'#35444b':colors.border}]}
          onPress={event=>event.stopPropagation()}>
          <View style={[styles.grip,{backgroundColor:referenceChat?'#647882':colors.border}]}/>
          <Text style={[styles.title,{color:referenceChat?'#e9edef':colors.text}]}>
            {en ? 'Add an attachment' : 'Ajouter une pièce jointe'}
          </Text>
          <Pressable accessibilityRole="button" style={styles.option}
            onPress={()=>{setMenuVisible(false);setGalleryVisible(true);}}>
            <KnowMeIcon name="discover" color={colors.accent} size={23}/>
            <View style={{flex:1}}>
              <Text style={[styles.optionLabel,{color:referenceChat?'#e9edef':colors.text}]}>{en ? 'Gallery' : 'Galerie KnowMe'}</Text>
              <Text style={[styles.detail,{color:referenceChat?'#aebac1':colors.muted}]}>
                {en ? 'Photos, videos and multiple selection' : 'Photos, vidéos et sélection multiple'}
              </Text>
            </View>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.option} onPress={()=>{void chooseFiles();}}>
            <KnowMeIcon name="create" color={colors.accent} size={23}/>
            <View style={{flex:1}}>
              <Text style={[styles.optionLabel,{color:referenceChat?'#e9edef':colors.text}]}>{en ? 'Files' : 'Fichiers'}</Text>
              <Text style={[styles.detail,{color:referenceChat?'#aebac1':colors.muted}]}>
                {en ? 'Android documents, audio and other files' : 'Documents, musiques et fichiers Android'}
              </Text>
            </View>
          </Pressable>
          <Pressable accessibilityRole="checkbox" accessibilityState={{checked:preferSticker}}
            style={styles.option} onPress={()=>setPreferSticker(v=>!v)}>
            <KnowMeIcon name="check" color={colors.muted} size={20}/>
            <Text style={[styles.optionLabel,{color:referenceChat?'#e9edef':colors.text}]}>
              {preferSticker?'☑':'☐'} {en?'Send PNG/WebP as stickers':'Envoyer PNG/WebP comme stickers'}
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={()=>setMenuVisible(false)} style={styles.close}>
            <Text style={{color:colors.accent,fontWeight:'700'}}>{en?'Cancel':'Annuler'}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
    <AndroidMediaLibraryPicker
      visible={galleryVisible}
      purpose="message"
      multiple
      allowVideo
      maxSelection={Infinity}
      onPickedMany={files=>{void sendFiles(files);}}
      onClose={()=>setGalleryVisible(false)}
    />
  </>;
}

const styles=StyleSheet.create({
  trigger:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center'},
  recordAndAttach:{flexDirection:'row',alignItems:'center',gap:3},
  referenceRow:{flex:1,flexDirection:'row',alignItems:'flex-end',gap:8,minWidth:0},
  referencePill:{backgroundColor:'#202c33',borderRadius:25,minHeight:49,
    paddingHorizontal:9,flex:1,flexDirection:'row',alignItems:'center',gap:4,minWidth:0},
  referenceTrigger:{width:34,height:44,alignItems:'center',justifyContent:'center'},
  progress:{fontSize:11,fontWeight:'700'},
  notice:{maxWidth:120,fontSize:10},
  scrim:{flex:1,backgroundColor:'rgba(0,0,0,.55)',justifyContent:'flex-end'},
  sheet:{paddingHorizontal:17,paddingTop:12,paddingBottom:28,borderWidth:1,
    borderTopLeftRadius:27,borderTopRightRadius:27,gap:6},
  grip:{width:42,height:4,borderRadius:3,alignSelf:'center',marginBottom:9},
  title:{fontSize:19,fontWeight:'800',marginBottom:8},
  option:{minHeight:64,flexDirection:'row',alignItems:'center',gap:14,paddingHorizontal:8},
  optionLabel:{fontSize:15,fontWeight:'700'},
  detail:{fontSize:12,lineHeight:18},
  close:{minHeight:49,alignItems:'center',justifyContent:'center',marginTop:8}
});
