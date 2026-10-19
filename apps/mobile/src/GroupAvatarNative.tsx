import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { API_URL, apiFetch, getAccessToken } from './api';
import { AndroidMediaLibraryPicker, type SelectedAndroidMedia } from './AndroidMediaLibraryPicker';
import { useAppearance } from './AppearanceProvider';
import { useI18n } from './I18nProvider';
import { KnowMeAlert as Alert } from './ui/KnowMeFeedback';
import { KnowMeIcon } from './ui/KnowMeUI';

const MAX_BYTES=5*1024*1024;
const ALLOWED=new Set(['image/jpeg','image/png','image/webp']);
type Capabilities={read:boolean;canEdit:boolean;allowedMime:string[];maxBytes:number};
type UploadSession={id:string;uploadToken:string};
type UploadedAsset={id:string;status:string;scannerVerdict?:string};
type ImageSource={uri:string;headers:{Authorization:string}};

/** Security: membership and edit roles come from the group-avatar API, not
 * from a client-side role label. Image contents use an authenticated request;
 * they are never published at /media/public/avatar. */
export function GroupAvatarNative({conversationId,title,canManage=false}:{
  conversationId:string;title:string;canManage?:boolean;
}) {
  const {colors}=useAppearance();
  const {locale}=useI18n();
  const en=locale==='en';
  const tr=(fr:string,english:string)=>en?english:fr;
  const base=`/conversations/${encodeURIComponent(conversationId)}/group/avatar`;
  const [canEdit,setCanEdit]=useState(false);
  const [photoLoaded,setPhotoLoaded]=useState(false);
  const [uri,setUri]=useState<ImageSource|null>(null);
  const [revision,setRevision]=useState(0);
  const [busy,setBusy]=useState(false);
  const [galleryOpen,setGalleryOpen]=useState(false);
  const [previewOpen,setPreviewOpen]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  useEffect(()=>{
    let current=true;
    setUri(null);
    setPhotoLoaded(false);
    setCanEdit(false);
    setError('');
    void (async()=>{
      try {
        const caps=await apiFetch<Capabilities>(base+'/capabilities');
        if(!current)return;
        setCanEdit(Boolean(canManage&&caps.canEdit));
        if(!caps.read)return;
        const token=await getAccessToken();
        if(current&&token)setUri({
          uri:`${API_URL}${base}?revision=${revision}`,
          headers:{Authorization:`Bearer ${token}`}
        });
      }catch(cause){
        if(current&&(cause as {status?:number})?.status!==404)
          setError(tr('Photo du groupe indisponible sur ce serveur.',
            'Group photos are unavailable on this server.'));
      }
    })();
    return()=>{current=false;};
  },[conversationId,revision,canManage,en]);

  async function uploadPhoto(file:SelectedAndroidMedia) {
    if(busy||!canEdit)return;
    setGalleryOpen(false);
    setBusy(true);setError('');setNotice('');
    let temporary:string|null=null;
    try {
      const mime=file.mime.toLowerCase();
      if(!ALLOWED.has(mime))
        throw new Error(tr('Choisis une image JPEG, PNG ou WebP.',
          'Select a JPEG, PNG or WebP picture.'));
      if(!FileSystem.cacheDirectory)
        throw new Error(tr('Cache privé indisponible.','Private cache unavailable.'));
      const ext=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';
      temporary=`${FileSystem.cacheDirectory}knowme-group-avatar-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      await FileSystem.copyAsync({from:file.uri,to:temporary});
      const info=await FileSystem.getInfoAsync(temporary,{size:true});
      const size=info.exists&&'size' in info ? info.size : 0;
      if(!size||size<1024||size>MAX_BYTES)
        throw new Error(tr('La photo doit peser entre 1 Ko et 5 Mo.',
          'Picture must be between 1 KB and 5 MB.'));
      const capabilities=await apiFetch<Capabilities>(base+'/capabilities');
      if(!capabilities.canEdit)
        throw new Error(tr('Seuls les administrateurs peuvent modifier la photo.',
          'Only administrators can edit the group picture.'));
      const session=await apiFetch<UploadSession>('/media/uploads',{
        method:'POST',
        body:JSON.stringify({
          purpose:'AVATAR',visibility:'PRIVATE',
          maxBytes:MAX_BYTES,allowedMime:[mime]
        })
      });
      const body=new FormData();
      body.append('file',{
        uri:temporary,name:`group-avatar.${ext}`,type:mime
      } as unknown as Blob);
      const asset=await apiFetch<UploadedAsset>(
        `/media/uploads/${encodeURIComponent(session.id)}/complete`,{
          method:'POST',headers:{'x-upload-token':session.uploadToken},body
        });
      if(asset.status!=='AVAILABLE'||asset.scannerVerdict!=='CLEAN')
        throw new Error(tr('La vérification de sécurité a refusé cette photo.',
          'The security scanner did not approve this photo.'));
      await apiFetch(base,{method:'PATCH',
        body:JSON.stringify({mediaAssetId:asset.id})});
      setRevision(v=>v+1);
      setNotice(tr('Photo du groupe enregistrée.','Group picture saved.'));
    }catch(cause){
      setError(cause instanceof Error?cause.message:
        tr('Impossible de changer la photo.','Unable to change group picture.'));
    }finally{
      if(temporary)
        await FileSystem.deleteAsync(temporary,{idempotent:true}).catch(()=>undefined);
      setBusy(false);
    }
  }

  function askRemove() {
    if(!canEdit||!photoLoaded||busy)return;
    Alert.alert(
      tr('Retirer la photo ?','Remove group picture?'),
      tr('Le groupe retrouvera son avatar par défaut.','The group will use its default avatar.'),
      [
        {text:tr('Annuler','Cancel'),style:'cancel'},
        {text:tr('Retirer','Remove'),style:'destructive',onPress:()=>void removePhoto()}
      ]
    );
  }
  async function removePhoto(){
    if(!canEdit||busy)return;
    setBusy(true);setError('');setNotice('');
    try {
      await apiFetch(base,{method:'DELETE'});
      setUri(null);setPhotoLoaded(false);
      setRevision(v=>v+1);
      setNotice(tr('Photo retirée.','Picture removed.'));
    }catch(cause){
      setError(cause instanceof Error?cause.message:
        tr('Impossible de retirer cette photo.','Could not remove picture.'));
    }finally{setBusy(false);}
  }

  return <View style={styles.root}>
    <View style={[styles.photoFrame,{backgroundColor:colors.backgroundAccent,
      borderColor:colors.border}]}>
      {uri?<Image source={uri} style={styles.avatarPhoto}
        onLoad={()=>setPhotoLoaded(true)}
        onError={()=>setPhotoLoaded(false)}
        resizeMode="cover" accessibilityLabel={tr('Photo du groupe','Group picture')}/>:null}
      {!photoLoaded?<KnowMeIcon name="profile" size={38} color={colors.accent}/>:null}
      <Pressable accessibilityRole="button"
        accessibilityLabel={tr('Voir la photo du groupe','View group picture')}
        accessibilityState={{disabled:!photoLoaded}}
        disabled={!photoLoaded||busy}
        onPress={()=>setPreviewOpen(true)}
        style={styles.openPhoto}/>
    </View>
    {canEdit?<View style={styles.actions}>
      <Pressable accessibilityRole="button" disabled={busy}
        accessibilityLabel={tr('Changer la photo du groupe','Change group picture')}
        onPress={()=>setGalleryOpen(true)}
        style={[styles.action,{backgroundColor:colors.backgroundAccent}]}>
        <KnowMeIcon name="camera" size={18} color={colors.accent}/>
        <Text style={[styles.actionText,{color:colors.accent}]}>
          {tr('Changer la photo','Change picture')}
        </Text>
      </Pressable>
      {photoLoaded?<Pressable accessibilityRole="button" disabled={busy}
        accessibilityLabel={tr('Retirer la photo','Remove picture')}
        onPress={askRemove} style={styles.action}>
        <Text style={[styles.actionText,{color:colors.danger}]}>
          {tr('Retirer','Remove')}
        </Text>
      </Pressable>:null}
    </View>:null}
    {busy?<View style={styles.loading}>
      <ActivityIndicator size="small" color={colors.accent}/>
      <Text style={{color:colors.muted,fontSize:12}}>
        {tr('Enregistrement…','Saving…')}
      </Text>
    </View>:null}
    {error?<Text accessibilityRole="alert" style={[styles.feedback,{color:colors.danger}]}>
      {error}
    </Text>:null}
    {notice?<Text accessibilityRole="alert" style={[styles.feedback,{color:colors.muted}]}>
      {notice}
    </Text>:null}
    <AndroidMediaLibraryPicker
      visible={galleryOpen&&!busy} allowVideo={false}
      purpose="profile" mediaFilter="photo" lockFilter
      onPicked={media=>void uploadPhoto(media)}
      onClose={()=>setGalleryOpen(false)}/>
    <Modal visible={previewOpen&&photoLoaded} transparent animationType="fade"
      onRequestClose={()=>setPreviewOpen(false)}>
      <View style={styles.previewBackdrop}>
        <Pressable accessibilityRole="button"
          accessibilityLabel={tr('Fermer','Close')}
          style={styles.closePreview} onPress={()=>setPreviewOpen(false)}>
          <KnowMeIcon name="close" size={24} color="#ffffff"/>
        </Pressable>
        {uri?<Image source={uri} resizeMode="contain"
          style={styles.preview} accessibilityLabel={title}/>:null}
      </View>
    </Modal>
  </View>;
}

const styles=StyleSheet.create({
  root:{alignItems:'center',gap:8,paddingVertical:9},
  photoFrame:{width:92,height:92,borderRadius:46,
    borderWidth:1,alignItems:'center',justifyContent:'center',overflow:'hidden'},
  avatarPhoto:{position:'absolute',width:'100%',height:'100%'},
  openPhoto:{...StyleSheet.absoluteFillObject},
  actions:{flexDirection:'row',flexWrap:'wrap',gap:8,justifyContent:'center'},
  action:{minHeight:44,paddingHorizontal:12,alignItems:'center',
    justifyContent:'center',gap:6,flexDirection:'row',borderRadius:14},
  actionText:{fontSize:12,fontWeight:'700'},
  loading:{flexDirection:'row',gap:8,alignItems:'center'},
  feedback:{fontSize:12,lineHeight:17,textAlign:'center'},
  previewBackdrop:{flex:1,backgroundColor:'rgba(0,0,0,.94)',
    justifyContent:'center',alignItems:'center',padding:14},
  preview:{width:'100%',height:'78%'},
  closePreview:{position:'absolute',top:36,right:16,minWidth:48,minHeight:48,
    justifyContent:'center',alignItems:'center',zIndex:2}
});
