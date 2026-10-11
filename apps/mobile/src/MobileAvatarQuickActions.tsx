import { KnowMeAlert as Alert } from './ui/KnowMeFeedback';
import { buildKnowMePublicAvatarUrl } from '@knowme/link-contract';
import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AndroidMediaLibraryPicker, SelectedAndroidMedia } from './AndroidMediaLibraryPicker';
import { useAppearance } from './AppearanceProvider';
import { apiFetch } from './api';
import { uploadKnowMeMobileMedia } from './mobile-media-upload';

export function MobileAvatarQuickActions({
  avatarUrl, displayName, onCreateStory, onUpdated
}:{
  avatarUrl?:string|null;
  displayName:string;
  onCreateStory:()=>void;
  onUpdated:()=>Promise<void>;
}) {
  const {colors}=useAppearance();
  const [menu,setMenu]=useState(false);
  const [preview,setPreview]=useState(false);
  const [chooseFile,setChooseFile]=useState(false);
  const [busy,setBusy]=useState(false);

  async function changeAvatar(media:SelectedAndroidMedia) {
    if(busy)return;
    setChooseFile(false);setBusy(true);
    try {
      const capability=await apiFetch<{upload:boolean;publicAvatar:boolean}>('/media/public/avatar-capabilities');
      if(!capability.upload||!capability.publicAvatar)
        throw new Error('Le serveur ne permet pas encore les photos de profil.');
      const assetId=await uploadKnowMeMobileMedia(media,'AVATAR');
      await apiFetch('/account/profile',{
        method:'PATCH',body:JSON.stringify({avatarUrl:buildKnowMePublicAvatarUrl(assetId)})
      });
      await onUpdated();
      Alert.alert('Photo de profil','Ta nouvelle photo est enregistrée.');
    }catch(cause){
      Alert.alert('Modification impossible',cause instanceof Error?cause.message:'Réessaie.');
    }finally{setBusy(false);}
  }

  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Actions de la photo de profil"
      accessibilityHint="Ajouter une story, voir ou changer ta photo"
      disabled={busy} onPress={()=>setMenu(true)}
      style={[styles.plus,{backgroundColor:colors.accent,borderColor:colors.background}]}>
      {busy?<ActivityIndicator color={colors.accentText} size="small"/>:
        <Text style={[styles.plusLabel,{color:colors.accentText}]}>+</Text>}
    </Pressable>

    <Modal visible={menu} transparent animationType="fade" onRequestClose={()=>setMenu(false)}>
      <Pressable onPress={()=>setMenu(false)} style={styles.shade}>
        <Pressable onPress={event=>event.stopPropagation()}
          style={[styles.sheet,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          <Text style={[styles.title,{color:colors.text}]}>Ma photo de profil</Text>
          <Pressable accessibilityRole="button" style={styles.action} onPress={()=>{setMenu(false);onCreateStory();}}>
            <Text style={[styles.actionText,{color:colors.text}]}>◉  Ajouter une story</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={!avatarUrl} style={styles.action}
            onPress={()=>{setMenu(false);setPreview(true);}}>
            <Text style={[styles.actionText,{color:avatarUrl?colors.text:colors.muted}]}>◎  Voir la photo de profil</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.action} onPress={()=>{setMenu(false);setChooseFile(true);}}>
            <Text style={[styles.actionText,{color:colors.text}]}>▧  Changer la photo</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.dismiss} onPress={()=>setMenu(false)}>
            <Text style={{color:colors.accent,fontWeight:'700'}}>Fermer</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>

    <Modal visible={preview && Boolean(avatarUrl)} animationType="fade"
      onRequestClose={()=>setPreview(false)}>
      <View style={[styles.preview,{backgroundColor:colors.background}]}>
        <Pressable accessibilityRole="button" onPress={()=>setPreview(false)} style={styles.previewClose}>
          <Text style={{color:colors.text,fontSize:16}}>‹ Retour</Text>
        </Pressable>
        {avatarUrl?<Image source={{uri:avatarUrl}} accessibilityLabel={displayName}
          style={styles.photo} resizeMode="contain"/>:null}
      </View>
    </Modal>

    <AndroidMediaLibraryPicker visible={chooseFile} onClose={()=>setChooseFile(false)}
      onPicked={media=>{void changeAvatar(media);}}/>
  </>;
}

const styles=StyleSheet.create({
  plus:{position:'absolute',bottom:-4,right:-7,minWidth:44,minHeight:44,
    borderWidth:3,borderRadius:22,alignItems:'center',justifyContent:'center',zIndex:3},
  plusLabel:{fontSize:24,lineHeight:28,fontWeight:'700'},
  shade:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.66)'},
  sheet:{borderWidth:1,borderTopLeftRadius:26,borderTopRightRadius:26,padding:18,paddingBottom:32,gap:6},
  title:{fontSize:18,fontWeight:'800',paddingBottom:8},
  action:{minHeight:52,justifyContent:'center',paddingHorizontal:12},
  actionText:{fontSize:15,fontWeight:'600'},
  dismiss:{minHeight:44,alignItems:'center',justifyContent:'center'},
  preview:{flex:1,justifyContent:'center'},
  previewClose:{position:'absolute',top:45,left:22,zIndex:2,minHeight:44},
  photo:{width:'100%',height:'80%'}
});
