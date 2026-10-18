import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';
import { KnowMeAlert } from './ui/KnowMeFeedback';

type Summary = {
  commentId: string;
  total: number;
  mine: string | null;
  emojis: Array<{ emoji: string; count: number }>;
};

const QUICK = ['❤️','😂','😮','😢','😡'];
const MORE = ['👍','👏','🔥','🥰','😍','🙏','💯','🎉','😎','💔','🤯','🤗','💪','🤣','🫶','🥹','🌟','✅','👀','🙌','🥳','💙'];

export function CommentReactionChip({ postId, commentId }: {postId:string;commentId:string}) {
  const { colors } = useAppearance();
  const [summary,setSummary] = useState<Summary|null>(null);
  const [open,setOpen] = useState(false);
  const [more,setMore] = useState(false);
  const [custom,setCustom] = useState('');
  const [busy,setBusy] = useState(false);
  const pending = useRef(false);
  const held = useRef(false);
  const endpoint = `/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/reactions`;

  useEffect(() => {
    let alive=true;
    void apiFetch<Summary>(endpoint).then(data=>{
      if(alive) setSummary(data);
    }).catch(()=>undefined);
    return () => {alive=false;};
  },[endpoint]);

  async function choose(emoji:string) {
    if(!emoji || pending.current) return;
    pending.current=true;
    setBusy(true);
    try {
      const remove = summary?.mine===emoji;
      const next=await apiFetch<Summary>(endpoint,remove
        ? {method:'DELETE'}
        : {method:'PUT',body:JSON.stringify({emoji})});
      setSummary(next);
      setOpen(false);
      setMore(false);
      setCustom('');
    } catch(cause) {
      KnowMeAlert.alert('Réaction impossible',
        cause instanceof Error?cause.message:'Connexion indisponible. Réessaie.');
    } finally {
      pending.current=false;
      setBusy(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={summary?.mine?'Modifier la réaction':'Réagir au commentaire'}
        disabled={busy}
        delayLongPress={390}
        onLongPress={()=>{held.current=true;setOpen(true);}}
        onPress={()=>{
          if(held.current){held.current=false;return;}
          void choose('❤️');
        }}
        style={({pressed})=>[styles.chip,{opacity:pressed?0.65:1}]}>
        <Text style={[styles.label,{color:colors.muted}]}>{summary?.mine??'♡'} {summary?.total||'J’aime'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Choisir une réaction emoji"
        onPress={()=>setOpen(true)} style={styles.pickerButton}>
        <Text style={[styles.label,{color:colors.muted}]}>☺</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={()=>setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={()=>setOpen(false)}
            accessibilityLabel="Fermer les réactions"/>
          <View style={[styles.sheet,{backgroundColor:colors.surface,borderColor:colors.border}]}>
            <View style={[styles.handle,{backgroundColor:colors.border}]}/>
            <Text style={[styles.heading,{color:colors.text}]}>Réagir au commentaire</Text>
            <ScrollView style={{maxHeight:310}} contentContainerStyle={styles.emojis}>
              {[...QUICK,...(more?MORE:[])].map(emoji=>
                <Pressable key={emoji} accessibilityRole="button" disabled={busy}
                  accessibilityLabel={`Réagir ${emoji}`}
                  onPress={()=>void choose(emoji)} style={[styles.emojiOption,{
                    backgroundColor:summary?.mine===emoji?colors.backgroundAccent:'transparent'
                  }]}>
                  <Text style={styles.emoji}>{emoji}</Text>
                </Pressable>
              )}
              <Pressable accessibilityRole="button" onPress={()=>setMore(v=>!v)}
                style={[styles.emojiOption,{backgroundColor:colors.backgroundAccent}]}>
                <Text style={[styles.emoji,{color:colors.text}]}>{more?'−':'+'}</Text>
              </Pressable>
            </ScrollView>
            {more && <View style={styles.customRow}>
              <TextInput value={custom} onChangeText={setCustom} maxLength={32}
                placeholder="Autre emoji depuis ton clavier…" placeholderTextColor={colors.muted}
                style={[styles.customInput,{color:colors.text,backgroundColor:colors.backgroundAccent}]}/>
              <Pressable accessibilityRole="button" disabled={busy||!custom.trim()}
                onPress={()=>void choose(custom.trim())}
                style={[styles.confirm,{backgroundColor:colors.accent,opacity:busy||!custom.trim()?0.45:1}]}>
                <Text style={{color:colors.accentText,fontWeight:'700'}}>OK</Text>
              </Pressable>
            </View>}
          </View>
        </View>
      </Modal>
    </>
  );
}
const styles=StyleSheet.create({
  chip:{minHeight:34,alignItems:'center',justifyContent:'center',paddingHorizontal:3},
  pickerButton:{minWidth:32,minHeight:34,alignItems:'center',justifyContent:'center'},
  label:{fontSize:13,fontWeight:'600'},
  overlay:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.54)'},
  sheet:{paddingHorizontal:14,paddingTop:10,paddingBottom:32,borderTopLeftRadius:26,borderTopRightRadius:26,borderWidth:StyleSheet.hairlineWidth},
  handle:{width:39,height:5,borderRadius:4,alignSelf:'center',marginBottom:16},
  heading:{fontSize:16,fontWeight:'800',marginBottom:10},
  emojis:{flexDirection:'row',flexWrap:'wrap',gap:4,paddingBottom:10},
  emojiOption:{width:48,height:48,borderRadius:14,alignItems:'center',justifyContent:'center'},
  emoji:{fontSize:28},
  customRow:{flexDirection:'row',alignItems:'center',gap:8},
  customInput:{flex:1,height:44,borderRadius:13,paddingHorizontal:11,fontSize:13},
  confirm:{height:44,minWidth:50,borderRadius:12,alignItems:'center',justifyContent:'center'}
});
