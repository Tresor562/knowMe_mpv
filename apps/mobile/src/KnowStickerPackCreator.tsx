import {useState} from 'react';
import {ActivityIndicator,Modal,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {AndroidMediaLibraryPicker,type SelectedAndroidMedia} from './AndroidMediaLibraryPicker';
import {createKnowStickerPack} from './KnowStickerPackStore';
import {KnowMeAlert as Alert} from './ui/KnowMeFeedback';
import {useAppearance} from './AppearanceProvider';

export function KnowStickerPackCreator({visible,onClose,onCreated}:{
  visible:boolean;onClose:()=>void;onCreated:()=>void;
}){
  const {colors}=useAppearance();
  const [name,setName]=useState('');
  const [galleryOpen,setGalleryOpen]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  async function create(files:SelectedAndroidMedia[]){
    if(saving||!files.length)return;
    setGalleryOpen(false);setSaving(true);setError('');
    try{
      const pack=await createKnowStickerPack(name,files);
      setName('');
      onCreated();
      Alert.alert('Pack créé',pack.items.length+' sticker(s) disponibles dans KnowMe.');
      onClose();
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Impossible de créer le pack.');
    }finally{setSaving(false);}
  }
  return <>
    <Modal visible={visible&&!galleryOpen} animationType="slide" transparent
      onRequestClose={()=>{if(!saving)onClose();}}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          <Text style={[styles.title,{color:colors.text}]}>Créer un pack KnowSticker</Text>
          <Text style={{color:colors.muted,fontSize:13,lineHeight:19}}>
            Choisis un nom et des images. KnowMe les convertit en WebP, puis les garde dans sa bibliothèque privée.
          </Text>
          <TextInput value={name} onChangeText={setName} maxLength={80}
            placeholder="Nom du pack" placeholderTextColor={colors.muted}
            selectionColor={colors.accent}
            style={[styles.input,{borderColor:colors.border,color:colors.text}]}/>
          {error?<Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text>:null}
          {saving?<ActivityIndicator color={colors.accent}/>:null}
          <Pressable accessibilityRole="button" disabled={saving||!name.trim()}
            onPress={()=>{setError('');setGalleryOpen(true);}}
            style={[styles.primary,{backgroundColor:colors.accent,opacity:!name.trim()?0.5:1}]}>
            <Text style={{color:colors.accentText,fontWeight:'800'}}>
              {saving?'Création…':'Choisir les images et créer'}
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={saving} style={styles.cancel} onPress={onClose}>
            <Text style={{color:colors.muted,fontWeight:'700'}}>Annuler</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
    <AndroidMediaLibraryPicker visible={visible&&galleryOpen} purpose="message"
      mediaFilter="photo" lockFilter allowVideo={false}
      multiple maxSelection={120}
      onPickedMany={files=>{void create(files);}}
      onClose={()=>setGalleryOpen(false)}/>
  </>;
}
const styles=StyleSheet.create({
  backdrop:{flex:1,backgroundColor:'#0009',justifyContent:'flex-end'},
  sheet:{padding:19,paddingBottom:32,borderTopLeftRadius:24,
    borderTopRightRadius:24,borderWidth:1,gap:15},
  title:{fontSize:20,fontWeight:'800'},
  input:{height:51,borderWidth:1,borderRadius:14,paddingHorizontal:15,fontSize:16},
  primary:{height:52,alignItems:'center',justifyContent:'center',borderRadius:16},
  cancel:{height:47,alignItems:'center',justifyContent:'center'}
});
