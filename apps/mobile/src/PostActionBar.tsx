import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppearance } from './AppearanceProvider';
import { KnowMeIcon } from './ui/KnowMeUI';

/** The API adapters are deliberately required. A reaction is never claimed saved locally. */
export type NativePostActionBarProps = {
  postId: string;
  en?: boolean;
  likeCount: number;
  commentCount: number;
  selectedReaction?: string | null;
  reactionCounts?: Array<{emoji:string;count:number}>;
  saved?: boolean;
  online?: boolean;
  onHeart: () => Promise<void>;
  onReact: (emoji: string) => Promise<void>;
  onComments: () => void;
  onShare: () => void;
  onSave?: () => Promise<void>;
};

const EMOJI_REACTIONS = ['❤️', '😂', '😮', '😢', '😡'];
function BookmarkIcon({ color, filled }: { color: string; filled: boolean }) {
  // Pure React Native geometry: rounded bookmark with a distinct notched base.
  return <View style={{width:21,height:23,alignItems:'center',justifyContent:'flex-start'}}>
    <View style={{width:17,height:17,borderTopWidth:1.8,borderLeftWidth:1.8,
      borderRightWidth:1.8,borderColor:color,borderTopLeftRadius:3,
      borderTopRightRadius:3,backgroundColor:filled?color:'transparent'}}/>
    <View style={{position:'absolute',top:12,width:12,height:12,borderLeftWidth:1.8,
      borderTopWidth:1.8,borderColor:color,transform:[{rotate:'45deg'}],
      backgroundColor:filled?color:'transparent'}}/>
  </View>;
}

const validEmoji = (value: string) => {
  const cleaned = value.trim();
  return Boolean(cleaned && cleaned.length <= 32 &&
    /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{20e3}]/u.test(cleaned));
};

export function PostActionBar({
  postId, en = false, likeCount, commentCount, selectedReaction = null,
  reactionCounts = [], saved = false, online = true, onHeart,
  onReact, onComments, onShare, onSave
}: NativePostActionBarProps) {
  const { colors } = useAppearance();
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const wasLongPress = useRef(false);
  const inFlight = useRef(false);

  function showReactions() {
    if (!online || busy) return;
    setError('');
    setOpen(true);
    setMore(false);
    setCustom('');
  }
  function close() {
    if (busy) return;
    setOpen(false);
    setMore(false);
    setError('');
  }
  async function action(callback: () => Promise<void>, isReaction = false) {
    if (!online || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await callback();
      if (isReaction) {
        setOpen(false);
        setCustom('');
        setMore(false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message :
        en ? 'Action not confirmed. Please retry.' : 'Action non confirmée. Réessaie.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const active = selectedReaction !== null;
  return <View style={styles.root} testID={`post-action-bar-${postId}`}>
    {reactionCounts.length > 0 && <View style={styles.reactionSummary} accessible
      accessibilityLabel="Réactions à la publication">
      {reactionCounts.filter(item=>item.count>0).slice(0,5).map(item=>(
        <Text key={item.emoji} style={[styles.summaryText,{color:colors.muted}]}>
          {item.emoji} {item.count}
        </Text>
      ))}
    </View>}
    <View style={styles.actions}>
      <View style={styles.likeGroup}>
        <Pressable accessibilityRole="button"
          accessibilityLabel={active
            ? (en?'Change my reaction':'Modifier ma réaction')
            : (en?'Like publication':'J’aime la publication')}
          accessibilityState={{selected:active,disabled:busy||!online}}
          disabled={busy||!online}
          delayLongPress={450}
          onPressOut={()=>setTimeout(()=>{wasLongPress.current=false;},0)}
          onLongPress={()=>{wasLongPress.current=true;showReactions();}}
          onPress={()=>{
            if(wasLongPress.current){wasLongPress.current=false;return;}
            void action(onHeart);
          }} style={({pressed})=>[styles.action,pressed&&styles.pressed]}>
          {selectedReaction&&selectedReaction!=='❤️'
            ?<Text style={styles.emoji}>{selectedReaction}</Text>
            :<KnowMeIcon name="heart" size={21} color={active?colors.accent:colors.muted}/>}
          <Text style={[styles.count,{color:active?colors.accent:colors.muted}]}>{likeCount}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={en?"Choose reaction":"Choisir une réaction"}
          accessibilityState={{disabled:busy||!online}}
          disabled={busy||!online} onPress={showReactions}
          style={({pressed})=>[styles.pickerTrigger,pressed&&styles.pressed]}>
          <KnowMeIcon name="chevron-down" size={16} color={colors.muted}/>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={en?`Comments: ${commentCount}`:`Commentaires : ${commentCount}`}
        onPress={onComments} style={({pressed})=>[styles.action,pressed&&styles.pressed]}>
        <KnowMeIcon name="messages" size={21} color={colors.muted}/>
        <Text style={[styles.count,{color:colors.muted}]}>{commentCount}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={en?"Share publication":"Partager la publication"}
        onPress={onShare} style={({pressed})=>[styles.action,pressed&&styles.pressed]}>
        <KnowMeIcon name="arrow" size={20} color={colors.muted}/>
        <Text style={[styles.label,{color:colors.muted}]}>{en?"Share":"Partager"}</Text>
      </Pressable>
      {onSave&&<Pressable accessibilityRole="button"
        accessibilityLabel={saved
          ? (en?'Remove from saved':'Retirer des favoris')
          : (en?'Save publication':'Enregistrer la publication')}
        accessibilityState={{selected:saved,disabled:busy||!online}}
        disabled={busy||!online} onPress={()=>void action(onSave)}
        style={({pressed})=>[styles.action,styles.save,pressed&&styles.pressed]}>
        <BookmarkIcon color={saved?colors.accent:colors.muted} filled={saved}/>
      </Pressable>}
    </View>
    {error&&!open&&<Text accessibilityRole="alert" style={[styles.error,{color:colors.danger}]}>{error}</Text>}
    <Modal visible={open} transparent animationType="slide" statusBarTranslucent
      onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel={en?"Close reactions":"Fermer les réactions"} onPress={close}/>
        <View style={[styles.sheet,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={[styles.title,{color:colors.text}]}>
              {en?'React to publication':'Réagir à la publication'}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel={en?"Close":"Fermer"}
              disabled={busy} onPress={close} style={styles.close}>
              <KnowMeIcon name="close" size={22} color={colors.text}/>
            </Pressable>
          </View>
          <View style={styles.emojiRow}>
            {EMOJI_REACTIONS.map(emoji=><Pressable key={emoji}
              accessibilityRole="button" accessibilityLabel={en?`React with ${emoji}`:`Réagir avec ${emoji}`}
              accessibilityState={{selected:selectedReaction===emoji,disabled:busy}}
              disabled={busy} onPress={()=>void action(()=>onReact(emoji),true)}
              style={[styles.emojiButton,selectedReaction===emoji&&{backgroundColor:colors.backgroundAccent}]}>
              <Text style={styles.emoji}>{emoji}</Text>
            </Pressable>)}
            <Pressable accessibilityRole="button" accessibilityLabel={en?"More emoji reactions":"Tous les emojis"}
              accessibilityState={{expanded:more}} disabled={busy}
              onPress={()=>setMore(v=>!v)} style={[styles.emojiButton,{backgroundColor:colors.backgroundAccent}]}>
              <Text style={[styles.plus,{color:colors.text}]}>+</Text>
            </Pressable>
          </View>
          {more&&<View style={styles.custom}>
            <Text style={[styles.instructions,{color:colors.muted}]}>
              {en?"Choose an emoji using your keyboard":"Choisis un emoji dans ton clavier"}
            </Text>
            <View style={styles.customRow}>
              <TextInput value={custom} onChangeText={setCustom} maxLength={32}
                accessibilityLabel={en?"Custom emoji":"Emoji personnalisé"}
                placeholder="😀" placeholderTextColor={colors.muted}
                style={[styles.input,{color:colors.text,backgroundColor:colors.backgroundAccent,
                  borderColor:colors.border}]}/>
              <Pressable disabled={busy||!validEmoji(custom)}
                accessibilityRole="button" accessibilityLabel={en?"Confirm reaction":"Valider la réaction"}
                onPress={()=>void action(()=>onReact(custom.trim()),true)}
                style={[styles.send,{backgroundColor:colors.accent,
                  opacity:busy||!validEmoji(custom)?0.45:1}]}>
                <Text style={styles.sendText}>{en?"React":"Réagir"}</Text>
              </Pressable>
            </View>
          </View>}
          {error&&<Text accessibilityRole="alert" style={[styles.error,{color:colors.danger}]}>{error}</Text>}
        </View>
      </View>
    </Modal>
  </View>;
}

const styles=StyleSheet.create({
  root:{width:'100%',minWidth:0},
  reactionSummary:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:5,minHeight:25},
  summaryText:{fontSize:12},
  actions:{flexDirection:'row',alignItems:'center',gap:3,marginTop:7},
  likeGroup:{flexDirection:'row',alignItems:'center'},
  action:{minHeight:46,minWidth:44,paddingHorizontal:9,flexDirection:'row',
    alignItems:'center',justifyContent:'center',gap:7,borderRadius:13},
  pickerTrigger:{minHeight:46,minWidth:44,justifyContent:'center',alignItems:'center'},
  save:{marginLeft:'auto'},
  count:{fontSize:12,fontWeight:'600'},
  label:{fontSize:12,fontWeight:'600'},
  emoji:{fontSize:24},
  pressed:{opacity:0.65},
  error:{fontSize:12,padding:8},
  overlay:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.56)'},
  sheet:{paddingHorizontal:14,paddingTop:15,paddingBottom:30,borderTopLeftRadius:26,
    borderTopRightRadius:26,borderWidth:1},
  heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:44},
  title:{fontSize:16,fontWeight:'700'},
  close:{width:44,height:44,alignItems:'center',justifyContent:'center'},
  emojiRow:{flexDirection:'row',gap:2,marginTop:10},
  emojiButton:{flex:1,minWidth:0,height:50,alignItems:'center',justifyContent:'center',borderRadius:14},
  plus:{fontSize:26},
  custom:{gap:8,marginTop:12},
  instructions:{fontSize:12},
  customRow:{flexDirection:'row',gap:9},
  input:{flex:1,minWidth:0,minHeight:46,paddingHorizontal:12,borderRadius:13,borderWidth:1,fontSize:20},
  send:{minWidth:80,minHeight:46,justifyContent:'center',alignItems:'center',borderRadius:13},
  sendText:{fontSize:13,fontWeight:'700',color:'#FFFFFF'}
});
