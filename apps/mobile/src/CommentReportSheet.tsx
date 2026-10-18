import {useRef,useState} from 'react';
import {
  ActivityIndicator,Modal,Pressable,ScrollView,StyleSheet,Text,TextInput,View
} from 'react-native';
import {apiFetch} from './api';
import {useAppearance} from './AppearanceProvider';
import {KnowMeIcon} from './ui/KnowMeUI';

const REASONS=[
  {code:'SPAM',label:'Spam ou publicité abusive'},
  {code:'HARASSMENT',label:'Harcèlement ou intimidation'},
  {code:'SCAM',label:'Arnaque ou tromperie'},
  {code:'INAPPROPRIATE',label:'Contenu inapproprié'},
  {code:'OTHER',label:'Autre raison'}
] as const;
type Reason=typeof REASONS[number]['code'];

export function CommentReportSheet({comment,onClose,onReported}:{
  comment:{id:string;content:string;author:{displayName:string}}|null;
  onClose:()=>void;
  onReported:()=>void;
}){
  const {colors}=useAppearance();
  const [reason,setReason]=useState<Reason|null>(null);
  const [details,setDetails]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const inflight=useRef(false);
  function close(){
    if(inflight.current)return;
    setReason(null);setDetails('');setError('');
    onClose();
  }
  async function submit(){
    if(!comment||!reason||inflight.current)return;
    inflight.current=true;setBusy(true);setError('');
    const choice=REASONS.find(option=>option.code===reason);
    const message=[choice?.label,details.trim()].filter(Boolean).join(' : ').slice(0,500);
    try{
      await apiFetch('/reports',{
        method:'POST',body:JSON.stringify({
          targetType:'COMMENT',targetId:comment.id,reason:message
        })
      });
      setReason(null);setDetails('');
      onReported();
      onClose();
    }catch(cause){
      const failure=cause as {code?:string;message?:string};
      const uncertain=failure?.code==='KNOWME_TIMEOUT'||
        failure?.code==='KNOWME_NETWORK_UNAVAILABLE';
      setError(uncertain
        ? 'Signalement non confirmé. Vérifie tes signalements avant de réessayer.'
        : cause instanceof Error?cause.message:'Signalement impossible.');
    }finally{inflight.current=false;setBusy(false);}
  }
  return <Modal visible={Boolean(comment)} transparent animationType="slide"
    onRequestClose={close} statusBarTranslucent>
    <View style={styles.root}>
      <Pressable style={styles.scrim} accessibilityRole="button"
        accessibilityLabel="Annuler le signalement" disabled={busy} onPress={close}/>
      <View style={[styles.sheet,{backgroundColor:colors.surface,borderColor:colors.border}]}>
        <View style={[styles.handle,{backgroundColor:colors.muted}]}/>
        <View style={styles.heading}>
          <Text style={[styles.title,{color:colors.text}]}>Signaler le commentaire</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Fermer"
            disabled={busy} onPress={close} style={styles.close}>
            <KnowMeIcon name="close" size={22} color={colors.muted}/>
          </Pressable>
        </View>
        <Text style={{color:colors.muted,fontSize:12,marginBottom:9}}>
          Commentaire de {comment?.author.displayName}
        </Text>
        <View style={[styles.preview,{backgroundColor:colors.backgroundAccent}]}>
          <Text style={{color:colors.text,fontSize:13,lineHeight:19}} numberOfLines={3}>
            {comment?.content}
          </Text>
        </View>
        <ScrollView style={{maxHeight:360}} keyboardShouldPersistTaps="handled">
          <Text style={[styles.prompt,{color:colors.text}]}>
            Pourquoi souhaites-tu signaler ce commentaire ?
          </Text>
          {REASONS.map(option=>(
            <Pressable key={option.code} accessibilityRole="radio"
              accessibilityState={{checked:reason===option.code}}
              accessibilityLabel={option.label}
              onPress={()=>setReason(option.code)} disabled={busy}
              style={[styles.choice,{borderColor:colors.border}]}>
              <View style={[styles.radio,{borderColor:reason===option.code?colors.accent:colors.muted}]}>
                {reason===option.code?<View style={[styles.dot,{backgroundColor:colors.accent}]}/>:null}
              </View>
              <Text style={{color:colors.text,fontSize:14,flex:1}}>{option.label}</Text>
            </Pressable>
          ))}
          <Text style={{color:colors.muted,fontSize:12,marginTop:15,marginBottom:6}}>
            Précisions (facultatif)
          </Text>
          <TextInput accessibilityLabel="Précisions du signalement"
            value={details} onChangeText={setDetails} multiline maxLength={350}
            placeholder="Décris brièvement le problème"
            placeholderTextColor={colors.muted} editable={!busy}
            style={[styles.details,{borderColor:colors.border,color:colors.text,
              backgroundColor:colors.backgroundAccent}]}/>
        </ScrollView>
        {Boolean(error)&&<Text accessibilityRole="alert"
          style={{color:colors.danger,fontSize:12,marginTop:9}}>{error}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel="Envoyer le signalement"
          disabled={busy||!reason} onPress={()=>void submit()}
          style={[styles.submit,{backgroundColor:reason&&!busy?colors.accent:colors.backgroundAccent}]}>
          {busy?<ActivityIndicator color={colors.accentText}/>:
            <Text style={{color:reason?colors.accentText:colors.muted,fontSize:14,fontWeight:'800'}}>
              Envoyer le signalement
            </Text>}
        </Pressable>
      </View>
    </View>
  </Modal>;
}
const styles=StyleSheet.create({
  root:{flex:1,justifyContent:'flex-end'},
  scrim:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,.65)'},
  sheet:{borderTopWidth:1,borderTopLeftRadius:27,borderTopRightRadius:27,
    paddingHorizontal:18,paddingTop:11,paddingBottom:29,maxHeight:'92%'},
  handle:{alignSelf:'center',width:35,height:4,borderRadius:2,opacity:.45,marginBottom:12},
  heading:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:3},
  title:{fontSize:17,fontWeight:'800',flex:1},
  close:{width:44,height:44,alignItems:'center',justifyContent:'center'},
  preview:{padding:12,borderRadius:13,marginBottom:7},
  prompt:{fontSize:13,fontWeight:'700',marginVertical:9},
  choice:{minHeight:49,borderBottomWidth:StyleSheet.hairlineWidth,
    alignItems:'center',flexDirection:'row',gap:11,paddingVertical:7},
  radio:{width:21,height:21,borderRadius:11,borderWidth:2,
    alignItems:'center',justifyContent:'center'},
  dot:{width:10,height:10,borderRadius:5},
  details:{minHeight:76,textAlignVertical:'top',fontSize:14,lineHeight:19,
    borderWidth:1,borderRadius:12,paddingHorizontal:12,paddingVertical:9},
  submit:{height:49,alignItems:'center',justifyContent:'center',
    borderRadius:17,marginTop:15}
});
