import {useEffect,useRef,useState} from 'react';
import {
  ActivityIndicator,Keyboard,KeyboardAvoidingView,Modal,Platform,Pressable,ScrollView,StyleSheet,
  Text,TextInput,View
} from 'react-native';
import {apiFetch} from './api';
import {Avatar,KnowMeIcon} from './ui/KnowMeUI';

const EMOJI_CHOICES=['😂','❤️','🔥','😍','🥰','👏','😮','😭','💯','👍','✨','🎉'];
type CommentPreview={id:string;content:string;author?:{displayName?:string|null;username?:string|null}};

/**
 * An actual post comment composer, not a decorative field.
 * The backend owns the persisted comment and its moderation decision.
 */
export function ReelQuickCommentSheet({postId,en,viewer,onClose,onSent,onViewComments}:{
  postId:string;en:boolean;
  viewer:{name:string;avatarUrl:string|null};
  onClose:()=>void;onSent:()=>void;onViewComments:()=>void;
}){
  const [text,setText]=useState('');
  const [emojisOpen,setEmojisOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [keyboardVisible,setKeyboardVisible]=useState(false);
  const [comments,setComments]=useState<CommentPreview[]>([]);
  const [loadingComments,setLoadingComments]=useState(true);
  const sending=useRef(false);
  const input=useRef<TextInput|null>(null);
  const valid=text.trim().length>0&&text.trim().length<=500;

  useEffect(()=>{
    const shown=Keyboard.addListener('keyboardDidShow',()=>setKeyboardVisible(true));
    const hidden=Keyboard.addListener('keyboardDidHide',()=>setKeyboardVisible(false));
    return()=>{shown.remove();hidden.remove();};
  },[]);

  useEffect(()=>{
    let live=true;
    void apiFetch<CommentPreview[]>('/posts/'+encodeURIComponent(postId)+'/comments?roots=true')
      .then(rows=>{if(live)setComments(Array.isArray(rows)?rows.slice(0,3):[]);})
      .catch(()=>{if(live)setComments([]);})
      .finally(()=>{if(live)setLoadingComments(false);});
    return()=>{live=false;};
  },[postId]);
  function insert(value:string){
    setText(current=>current+value);
    input.current?.focus();
  }
  async function send(){
    const content=text.trim();
    if(sending.current||content.length===0||content.length>500)return;
    sending.current=true;
    setBusy(true);
    setError('');
    try{
      await apiFetch('/posts/'+encodeURIComponent(postId)+'/comments',{
        method:'POST',body:JSON.stringify({content})
      });
      // Only the confirmed server response increments the count.
      onSent();
    }catch(cause){
      const code=(cause as {code?:string})?.code;
      setError(code==='KNOWME_TIMEOUT'||code==='KNOWME_NETWORK_UNAVAILABLE'
        ?(en?'Delivery uncertain. Check comments before retrying.':
          'Envoi non confirmé. Vérifie les commentaires avant de réessayer.')
        :cause instanceof Error?cause.message:
          (en?'Comment could not be posted.':'Publication du commentaire impossible.'));
    }finally{sending.current=false;setBusy(false);}
  }
  return <Modal transparent visible animationType="slide" statusBarTranslucent
    onRequestClose={()=>{if(!busy)onClose();}}>
    <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'}
      style={styles.root}>
      <Pressable accessibilityRole="button"
        accessibilityLabel={en?'Close comment':'Fermer le commentaire'}
        style={styles.scrim} onPress={()=>{if(!busy)onClose();}}/>
      <View style={styles.sheet}>
        <View style={styles.handle}/>
        <View style={styles.header}>
          <Text style={styles.title}>{en?'Add a comment':'Ajouter un commentaire'}</Text>
          <Pressable style={styles.close} accessibilityRole="button"
            accessibilityLabel={en?'Close':'Fermer'}
            disabled={busy} onPress={onClose}>
            <KnowMeIcon name="close" color="#fff" size={23}/>
          </Pressable>
        </View>
        {!keyboardVisible&&(loadingComments||comments.length>0)&&
          <View style={styles.previewSection}>
            <Text style={styles.previewHeading}>
              {en?'Recent comments':'Commentaires récents'}
            </Text>
            {loadingComments?<ActivityIndicator color="#82e9dc"/>:
              <ScrollView style={styles.previewList} nestedScrollEnabled
                keyboardShouldPersistTaps="handled">
                {comments.map(comment=><Pressable key={comment.id}
                  accessibilityRole="button" onPress={onViewComments}
                  style={styles.previewComment}>
                  <Text style={styles.previewAuthor}>
                    {comment.author?.displayName??comment.author?.username??'KnowMe'}
                  </Text>
                  <Text style={styles.previewBody} numberOfLines={2}>{comment.content}</Text>
                </Pressable>)}
              </ScrollView>}
          </View>}
        <View style={styles.editor}>
          <Avatar name={viewer.name} uri={viewer.avatarUrl} size={36}/>
          <TextInput ref={input} multiline maxLength={500}
            style={styles.input} value={text} onChangeText={setText}
            editable={!busy} autoCorrect
            placeholder={en?'Write a comment…':'Écris un commentaire…'}
            placeholderTextColor="#a5b2b9"
            accessibilityLabel={en?'Comment text':'Texte du commentaire'}/>
        </View>
        <View style={styles.toolbar}>
          <Pressable style={styles.toolbarButton} accessibilityRole="button"
            accessibilityLabel={en?'Mention someone':'Mentionner un utilisateur'}
            disabled={busy} onPress={()=>insert('@')}>
            <Text style={styles.at}>@</Text>
          </Pressable>
          <Pressable style={styles.toolbarButton} accessibilityRole="button"
            accessibilityLabel={en?'Choose emoji':'Choisir un emoji'}
            accessibilityState={{expanded:emojisOpen}}
            disabled={busy} onPress={()=>setEmojisOpen(value=>!value)}>
            <KnowMeIcon name="smile" color="#fff" size={24}/>
          </Pressable>
          <Text style={styles.count}>{text.length}/500</Text>
          <Pressable style={[styles.send,!valid&&styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel={en?'Publish comment':'Publier le commentaire'}
            accessibilityState={{disabled:!valid||busy}}
            disabled={!valid||busy} onPress={()=>{void send();}}>
            {busy?<ActivityIndicator color="#06332d"/>:
              <Text style={styles.sendText}>{en?'Post':'Publier'}</Text>}
          </Pressable>
        </View>
        {emojisOpen&&<View style={styles.emojiTray}>
          {EMOJI_CHOICES.map(emoji=><Pressable key={emoji}
            accessibilityRole="button"
            accessibilityLabel={en?'Insert '+emoji:'Insérer '+emoji}
            style={styles.emojiButton} disabled={busy} onPress={()=>insert(emoji)}>
            <Text style={styles.emojiText}>{emoji}</Text>
          </Pressable>)}
        </View>}
        {Boolean(error)&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <Pressable style={styles.commentsLink} accessibilityRole="button"
          disabled={busy} onPress={onViewComments}>
          <Text style={styles.commentsLinkText}>
            {en?'See all comments':'Voir tous les commentaires'}
          </Text>
          <KnowMeIcon name="arrow" color="#a6f7ef" size={17}/>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const styles=StyleSheet.create({
  root:{flex:1,justifyContent:'flex-end'},
  scrim:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,.6)'},
  sheet:{backgroundColor:'#1c242b',borderTopLeftRadius:25,borderTopRightRadius:25,
    paddingHorizontal:16,paddingTop:10,paddingBottom:14,gap:9,maxHeight:'76%'},
  handle:{alignSelf:'center',width:46,height:5,borderRadius:4,backgroundColor:'#70818a'},
  header:{minHeight:47,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  title:{fontSize:17,fontWeight:'800',color:'#fff'},
  close:{width:44,height:44,justifyContent:'center',alignItems:'center'},
  editor:{flexDirection:'row',gap:10,alignItems:'flex-start',
    padding:10,borderRadius:18,backgroundColor:'#2a353e'},
  input:{flex:1,fontSize:15,color:'#fff',minHeight:40,maxHeight:112,
    textAlignVertical:'top',paddingTop:4,paddingBottom:3},
  toolbar:{flexDirection:'row',alignItems:'center',gap:4},
  toolbarButton:{height:44,width:44,alignItems:'center',justifyContent:'center'},
  at:{color:'#fff',fontSize:24,fontWeight:'800'},
  count:{flex:1,color:'#a6b5be',fontSize:12,textAlign:'right',marginRight:7},
  send:{minHeight:44,minWidth:78,paddingHorizontal:12,borderRadius:16,
    backgroundColor:'#82e9dc',alignItems:'center',justifyContent:'center'},
  disabled:{opacity:.4},
  sendText:{color:'#082b29',fontSize:14,fontWeight:'800'},
  emojiTray:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between'},
  emojiButton:{width:'16.66%',height:44,alignItems:'center',justifyContent:'center'},
  emojiText:{fontSize:23},
  error:{color:'#ffc1c4',fontSize:12,lineHeight:18},
  previewSection:{gap:5,maxHeight:177},
  previewHeading:{color:'#b4c7cd',fontSize:12,fontWeight:'700'},
  previewList:{maxHeight:150},
  previewComment:{minHeight:46,paddingVertical:6,borderBottomWidth:StyleSheet.hairlineWidth,
    borderBottomColor:'#455158'},
  previewAuthor:{fontSize:13,color:'#fff',fontWeight:'700'},
  previewBody:{fontSize:13,color:'#b7c6cf'},
  commentsLink:{height:44,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8},
  commentsLinkText:{color:'#a6f7ef',fontSize:13,fontWeight:'700'}
});
