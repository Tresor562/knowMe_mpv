import {useEffect,useRef,useState} from 'react';
import {
  ActivityIndicator,KeyboardAvoidingView,Modal,Platform,
  Pressable,ScrollView,StyleSheet,Text,TextInput,View
} from 'react-native';
import {apiFetch} from './api';
import {useAppearance} from './AppearanceProvider';
import {KnowMeIcon} from './ui/KnowMeUI';

type EditablePost={id:string;content:string;hasMedia:boolean};

export function PostEditSheet({post,onClose,onSaved}:{
  post:EditablePost|null;onClose:()=>void;onSaved:(content:string)=>void;
}){
  const {colors}=useAppearance();
  const [content,setContent]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const pending=useRef(false);
  useEffect(()=>{setContent(post?.content??'');setError('');},[post?.id,post?.content]);
  const valid=(Boolean(content.trim())||Boolean(post?.hasMedia))
    && content!==post?.content;
  function close(){if(!pending.current)onClose();}
  async function save(){
    if(!post||!valid||pending.current)return;
    pending.current=true;setBusy(true);setError('');
    try{
      const response=await apiFetch<{content:string}>(
        '/posts/'+encodeURIComponent(post.id),{
          method:'PATCH',body:JSON.stringify({content})
        }
      );
      onSaved(response.content);
      onClose();
    }catch(e){
      const error=e as {code?:string;message?:string};
      const uncertain=error.code==='KNOWME_TIMEOUT'||
        error.code==='KNOWME_NETWORK_UNAVAILABLE';
      setError(uncertain
        ? 'Modification non confirmée. Vérifie la publication avant de recommencer.'
        : e instanceof Error?e.message:'Modification impossible.');
    }finally{pending.current=false;setBusy(false);}
  }
  return <Modal visible={Boolean(post)} transparent animationType="slide"
    onRequestClose={close} statusBarTranslucent>
    <KeyboardAvoidingView style={styles.root}
      behavior={Platform.OS==='ios'?'padding':undefined}>
      <Pressable accessibilityRole="button" accessibilityLabel="Annuler la modification"
        disabled={busy} onPress={close} style={styles.scrim}/>
      <View style={[styles.sheet,{backgroundColor:colors.surface,borderColor:colors.border}]}>
        <View style={[styles.handle,{backgroundColor:colors.muted}]}/>
        <View style={styles.header}>
          <Text style={{fontSize:17,fontWeight:'800',color:colors.text}}>Modifier la publication</Text>
          <Pressable onPress={close} disabled={busy} accessibilityRole="button"
            accessibilityLabel="Fermer" style={styles.close}>
            <KnowMeIcon name="close" size={22} color={colors.muted}/>
          </Pressable>
        </View>
        <Text style={{fontSize:12,color:colors.muted}}>
          Les médias déjà publiés restent joints à ta publication.
        </Text>
        <ScrollView keyboardShouldPersistTaps="handled" style={{maxHeight:360}}>
          <TextInput accessibilityLabel="Texte de la publication à modifier"
            multiline value={content} onChangeText={setContent}
            editable={!busy} autoFocus={Boolean(post)} textAlignVertical="top"
            selectionColor={colors.accent}
            style={[styles.input,{borderColor:colors.border,
              color:colors.text,backgroundColor:colors.backgroundAccent}]}/>
        </ScrollView>
        <Text style={{fontSize:11,color:colors.muted,textAlign:'right'}}>
          {content.length} caractères
        </Text>
        {Boolean(error)&&<Text accessibilityRole="alert"
          style={{color:colors.danger,fontSize:12}}>{error}</Text>}
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={close} disabled={busy}
            style={[styles.action,{backgroundColor:colors.backgroundAccent}]}>
            <Text style={{color:colors.text,fontWeight:'700'}}>Annuler</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Enregistrer la publication"
            disabled={!valid||busy} onPress={()=>void save()}
            style={[styles.action,{backgroundColor:valid&&!busy?colors.accent:colors.backgroundAccent}]}>
            {busy?<ActivityIndicator color={colors.accentText}/>:
              <Text style={{color:valid?colors.accentText:colors.muted,fontWeight:'800'}}>
                Enregistrer
              </Text>}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const styles=StyleSheet.create({
  root:{flex:1,justifyContent:'flex-end'},
  scrim:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,.65)'},
  sheet:{padding:18,paddingBottom:30,borderTopLeftRadius:27,
    borderTopRightRadius:27,borderTopWidth:1,gap:12},
  handle:{width:36,height:4,borderRadius:2,opacity:.45,alignSelf:'center'},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  close:{width:44,height:44,alignItems:'center',justifyContent:'center'},
  input:{minHeight:140,fontSize:16,lineHeight:23,borderWidth:1,borderRadius:15,padding:12},
  actions:{flexDirection:'row',gap:10},
  action:{flex:1,minHeight:46,borderRadius:16,alignItems:'center',justifyContent:'center'}
});
