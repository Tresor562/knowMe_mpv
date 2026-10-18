import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,KeyboardAvoidingView,Modal,Platform,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {useAppearance} from './AppearanceProvider';
import {KnowMeIcon} from './ui/KnowMeUI';

export function CommentEditSheet({comment,save,onClose}:{
  comment:{id:string;content:string}|null;
  save:(id:string,content:string)=>Promise<void>;
  onClose:()=>void;
}){
  const {colors}=useAppearance();
  const [draft,setDraft]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const pending=useRef(false);
  useEffect(()=>{setDraft(comment?.content??'');setError('');},[comment?.id,comment?.content]);
  const content=draft.trim();
  const valid=content.length>0&&content.length<=500&&content!==comment?.content.trim();
  function close(){if(!pending.current)onClose();}
  async function submit(){
    if(!comment||!valid||pending.current)return;
    pending.current=true;setBusy(true);setError('');
    try{await save(comment.id,content);onClose();}
    catch(e){
      const cause=e as {code?:string;message?:string};
      const uncertain=cause.code==='KNOWME_TIMEOUT'||cause.code==='KNOWME_NETWORK_UNAVAILABLE';
      setError(uncertain
        ? 'Modification non confirmée. Actualise les commentaires avant de renvoyer.'
        :cause instanceof Error?cause.message:'Modification impossible.');
    }finally{pending.current=false;setBusy(false);}
  }
  return <Modal visible={Boolean(comment)} animationType="slide" transparent
    onRequestClose={close} statusBarTranslucent>
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS==='ios'?'padding':undefined}>
      <Pressable style={styles.scrim} onPress={close} accessibilityLabel="Fermer la modification" disabled={busy}/>
      <View style={[styles.sheet,{backgroundColor:colors.surface,borderColor:colors.border}]}>
        <View style={[styles.handle,{backgroundColor:colors.muted}]}/>
        <View style={styles.head}>
          <Text style={[styles.title,{color:colors.text}]}>Modifier le commentaire</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Annuler la modification"
            disabled={busy} onPress={close} style={styles.close}>
            <KnowMeIcon name="close" color={colors.muted} size={22}/>
          </Pressable>
        </View>
        <TextInput accessibilityLabel="Texte du commentaire à modifier"
          value={draft} onChangeText={setDraft} maxLength={500} multiline
          editable={!busy} autoFocus={Boolean(comment)}
          textAlignVertical="top"
          style={[styles.input,{color:colors.text,backgroundColor:colors.backgroundAccent,
            borderColor:colors.border}]} selectionColor={colors.accent}/>
        <Text style={{fontSize:11,color:colors.muted,textAlign:'right'}}>{draft.length}/500</Text>
        {Boolean(error)&&<Text accessibilityRole="alert" style={{color:colors.danger,fontSize:12}}>{error}</Text>}
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={close} disabled={busy}
            style={[styles.button,{backgroundColor:colors.backgroundAccent}]}>
            <Text style={{fontWeight:'700',color:colors.text}}>Annuler</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Enregistrer le commentaire"
            disabled={!valid||busy} onPress={()=>void submit()}
            style={[styles.button,{backgroundColor:valid&&!busy?colors.accent:colors.backgroundAccent}]}>
            {busy?<ActivityIndicator color={colors.accentText}/>:
              <Text style={{fontWeight:'800',color:valid?colors.accentText:colors.muted}}>Enregistrer</Text>}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const styles=StyleSheet.create({
  root:{flex:1,justifyContent:'flex-end'},
  scrim:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,.63)'},
  sheet:{paddingHorizontal:18,paddingTop:10,paddingBottom:30,borderTopWidth:1,
    borderTopLeftRadius:27,borderTopRightRadius:27,gap:12},
  handle:{alignSelf:'center',height:4,width:36,borderRadius:2,opacity:.55},
  head:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  title:{fontWeight:'800',fontSize:17},
  close:{width:44,height:44,justifyContent:'center',alignItems:'center'},
  input:{minHeight:100,maxHeight:235,fontSize:15,lineHeight:22,padding:13,
    borderWidth:1,borderRadius:16},
  actions:{flexDirection:'row',gap:10,marginTop:3},
  button:{flex:1,minHeight:46,alignItems:'center',justifyContent:'center',borderRadius:17}
});
