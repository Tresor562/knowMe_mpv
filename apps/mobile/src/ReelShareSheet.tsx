import {useEffect,useMemo,useRef,useState} from 'react';
import {
  ActivityIndicator,Alert,KeyboardAvoidingView,Modal,Platform,Pressable,
  ScrollView,Share,StyleSheet,Text,TextInput,View
} from 'react-native';
import {buildKnowMePublicLink} from '@knowme/link-contract';
import {apiFetch} from './api';
import {downloadPublicVideoOffline,savedPublicVideo} from './offline-public-video';
import {KnowMeIcon,type KnowMeIconName} from './ui/KnowMeUI';

type ReelSharePost={
  id:string;
  content:string;
  author:{username:string;displayName:string};
};
type ShareConversation={
  id:string;
  title?:string|null;
  isGroup?:boolean;
  members?:Array<{
    userId:string;
    user?:{id:string;displayName?:string|null;username?:string|null}|null
  }>;
};

function conversationName(chat:ShareConversation,en:boolean){
  if(chat.title?.trim())return chat.title.trim();
  const people=(chat.members??[])
    .map(member=>member.user?.displayName?.trim()||member.user?.username?.trim()||'')
    .filter(Boolean);
  return people.join(', ')||(chat.isGroup?(en?'Group':'Groupe'):(en?'Conversation':'Discussion'));
}

function initialFor(name:string){
  return name.trim().slice(0,1).toLocaleUpperCase()||'?';
}

function ReelAction({icon,label,onPress,disabled=false}:{
  icon:KnowMeIconName;label:string;onPress:()=>void;disabled?:boolean
}){
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
    style={({pressed})=>[styles.quickAction,pressed&&styles.pressed,disabled&&styles.disabled]}>
    <View style={styles.quickCircle}><KnowMeIcon name={icon} size={24} color="#fff"/></View>
    <Text numberOfLines={2} style={styles.quickLabel}>{label}</Text>
  </Pressable>;
}

/** Native KnowMe Reels bottom sheet; all writes use existing authenticated APIs. */
export function ReelShareSheet({post,videoUrl,en,onClose,onOpenPost,onHide,onOpenDownloads}:{
  videoUrl:string;
  post:ReelSharePost;
  en:boolean;
  onClose:()=>void;
  onOpenPost:()=>void;
  onHide:()=>void;
  onOpenDownloads:()=>void;
}){
  const [conversations,setConversations]=useState<ShareConversation[]>([]);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  const [query,setQuery]=useState('');
  const [selectedId,setSelectedId]=useState('');
  const [note,setNote]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [downloadPct,setDownloadPct]=useState(0);
  const [busy,setBusy]=useState(false);
  const inflight=useRef(false);
  const link=useMemo(()=>buildKnowMePublicLink({kind:'post',id:post.id}),[post.id]);
  const creator=post.author.displayName?.trim()||'@'+post.author.username;

  useEffect(()=>{
    let active=true;
    setLoading(true);
    setLoadError('');
    void apiFetch<ShareConversation[]>('/conversations').then(result=>{
      if(!active)return;
      if(!Array.isArray(result))throw new Error(en?'Conversations unavailable.':'Conversations indisponibles.');
      setConversations(result);
    }).catch(cause=>{
      if(!active)return;
      setConversations([]);
      setLoadError(cause instanceof Error?cause.message:
        (en?'Could not load conversations.':'Impossible de charger les conversations.'));
    }).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[post.id,en]);

  const visible=useMemo(()=>conversations.filter(chat=>
    conversationName(chat,en).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  ),[conversations,query,en]);

  async function send(){
    if(inflight.current||!selectedId)return;
    const target=conversations.find(chat=>chat.id===selectedId);
    if(!target)return;
    const content=[note.trim(),creator+' · KnowMe',link].filter(Boolean).join('\n\n');
    if(content.length>4000){
      setError(en?'Message cannot exceed 4,000 characters.':'Le message ne doit pas dépasser 4 000 caractères.');
      return;
    }
    inflight.current=true;setBusy(true);setError('');
    try{
      await apiFetch('/conversations/'+encodeURIComponent(target.id)+'/messages',{
        method:'POST',body:JSON.stringify({content})
      });
      onClose();
    }catch(cause){
      const code=(cause as {code?:string})?.code;
      setError(code==='KNOWME_TIMEOUT'||code==='KNOWME_NETWORK_UNAVAILABLE'
        ?(en?'Delivery uncertain. Check your chat before retrying.':
          'Envoi non confirmé. Vérifie la discussion avant de réessayer.')
        :cause instanceof Error?cause.message:
          (en?'Message could not be sent.':'Envoi du message impossible.'));
    }finally{inflight.current=false;setBusy(false);}
  }

  async function saveOffline(){
    if(inflight.current)return;
    inflight.current=true;setBusy(true);setError('');setNotice('');setDownloadPct(0);
    try{
      const already=await savedPublicVideo(videoUrl);
      if(!already)await downloadPublicVideoOffline(videoUrl,fraction=>{
        setDownloadPct(Math.round(Math.max(0,Math.min(1,fraction))*100));
      });
      setNotice(en?'Saved to your offline videos.':'Vidéo enregistrée hors ligne.');
    }catch(cause){
      setError(cause instanceof Error?cause.message:
        (en?'Download failed.':'Téléchargement impossible.'));
    }finally{inflight.current=false;setBusy(false);}
  }

  async function shareExternally(){
    if(busy)return;
    try{
      await Share.share({message:link,title:creator+' · KnowMe'});
    }catch(cause){
      setError(cause instanceof Error?cause.message:
        (en?'Sharing is unavailable.':'Partage indisponible.'));
    }
  }

  async function publishRepost(){
    if(inflight.current)return;
    inflight.current=true;setBusy(true);setError('');
    try{
      await apiFetch('/posts',{method:'POST',body:JSON.stringify({
        content:creator+' · KnowMe\n\n'+link
      })});
      onClose();
    }catch(cause){
      setError(cause instanceof Error?cause.message:
        (en?'Could not repost.':'Republication impossible.'));
    }finally{inflight.current=false;setBusy(false);}
  }

  function confirmRepost(){
    if(busy)return;
    Alert.alert(en?'Repost this Reel?':'Republier ce Reel ?',
      en?'A new public post will contain a link to the original Reel.':
        'Une nouvelle publication publique contiendra le lien du Reel original.',[
        {text:en?'Cancel':'Annuler',style:'cancel'},
        {text:en?'Repost':'Republier',onPress:()=>{void publishRepost();}}
      ]);
  }

  async function publishStory(audience:'FRIENDS'|'PUBLIC'){
    if(inflight.current)return;
    inflight.current=true;setBusy(true);setError('');
    try{
      await apiFetch('/stories',{method:'POST',body:JSON.stringify({
        type:'LINK',linkUrl:link,audience,durationHours:24,
        allowSharing:true,allowReplies:true,allowReactions:true
      })});
      onClose();
    }catch(cause){
      setError(cause instanceof Error?cause.message:
        (en?'Story could not be published.':'Partage dans la Story impossible.'));
    }finally{inflight.current=false;setBusy(false);}
  }

  function chooseStoryAudience(){
    if(busy)return;
    Alert.alert(en?'Who can see this Story?':'Qui peut voir cette Story ?',
      en?'The Story will contain a link to the original Reel.':
        'La Story contiendra un lien vers le Reel original.',[
        {text:en?'Cancel':'Annuler',style:'cancel'},
        {text:en?'Friends':'Amis',onPress:()=>{void publishStory('FRIENDS');}},
        {text:en?'Public':'Public',onPress:()=>{void publishStory('PUBLIC');}}
      ]);
  }

  return <Modal transparent animationType="slide" visible statusBarTranslucent
    onRequestClose={()=>{if(!busy)onClose();}}>
    <KeyboardAvoidingView style={styles.layer}
      behavior={Platform.OS==='ios'?'padding':undefined}>
      <Pressable accessibilityRole="button"
        accessibilityLabel={en?'Close share menu':'Fermer le partage'}
        style={styles.scrim} onPress={()=>{if(!busy)onClose();}}/>
      <View style={styles.sheet} accessibilityViewIsModal>
        <View style={styles.handle}/>
        <View style={styles.heading}>
          <View style={styles.headingSpacer}/>
          <Text style={styles.title}>{en?'Send to':'Envoyer à'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={en?'Close':'Fermer'}
            disabled={busy} onPress={onClose} style={styles.close}>
            <KnowMeIcon name="close" size={23} color="#fff"/>
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.search}>
            <KnowMeIcon name="search" size={21} color="#bbb"/>
            <TextInput value={query} onChangeText={setQuery}
              placeholder={en?'Search friends or groups':'Rechercher des amis ou groupes'}
              placeholderTextColor="#999" style={styles.searchInput}
              autoCorrect={false} accessibilityLabel={en?'Find a conversation':'Rechercher une conversation'}/>
          </View>
          {loading?<ActivityIndicator color="#84e9dd" style={{marginVertical:25}}/>:
            loadError?<View style={styles.listMessage}>
              <Text style={styles.hint}>{loadError}</Text>
              <Pressable accessibilityRole="button" onPress={onOpenPost}>
                <Text style={styles.accent}>{en?'Open original post':'Ouvrir la publication'}</Text>
              </Pressable>
            </View>:visible.length?(
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="always" contentContainerStyle={styles.recipients}>
                {visible.map(chat=>{
                  const name=conversationName(chat,en);
                  const selected=selectedId===chat.id;
                  return <Pressable key={chat.id} accessibilityRole="button"
                    accessibilityState={{selected,disabled:busy}}
                    accessibilityLabel={name} disabled={busy}
                    onPress={()=>setSelectedId(current=>current===chat.id?'':chat.id)}
                    style={styles.recipient}>
                    <View style={[styles.avatar,selected&&styles.selectedAvatar]}>
                      <Text style={styles.avatarInitial}>{initialFor(name)}</Text>
                      {selected?<View style={styles.checkBadge}>
                        <KnowMeIcon name="check" size={13} color="#072e28"/>
                      </View>:null}
                    </View>
                    <Text style={styles.recipientName} numberOfLines={2}>{name}</Text>
                  </Pressable>;
                })}
              </ScrollView>
            ):<Text style={styles.hint}>
              {query?(en?'No matching conversations.':'Aucune discussion trouvée.'):
                (en?'No available conversations.':'Aucune discussion disponible.')}
            </Text>}
          {Boolean(selectedId)&&!loadError&&<View style={styles.composer}>
            <TextInput value={note} onChangeText={setNote} multiline
              maxLength={3500} placeholder={en?'Add a message (optional)':'Ajouter un message (facultatif)'}
              placeholderTextColor="#999" style={styles.note}/>
            <Pressable accessibilityRole="button" disabled={busy}
              accessibilityLabel={en?'Send Reel':'Envoyer le Reel'} onPress={()=>{void send();}}
              style={[styles.send,busy&&styles.disabled]}>
              <Text style={styles.sendLabel}>{busy?(en?'Sending…':'Envoi…'):(en?'Send':'Envoyer')}</Text>
            </Pressable>
          </View>}
          <View style={styles.divider}/>
          <Text style={styles.section}>{en?'Share':'Partager'}</Text>
          <View style={styles.quickRow}>
            <ReelAction icon="refresh" label={en?'Repost':'Republier'} disabled={busy}
              onPress={confirmRepost}/>
            <ReelAction icon="create" label={en?'My Story':'Ma Story'} disabled={busy}
              onPress={chooseStoryAudience}/>
            <ReelAction icon="arrow" label={en?'Other apps / link':'Applis / lien'} disabled={busy}
              onPress={()=>{void shareExternally();}}/>
            <ReelAction icon="download" label={busy?(en?'Downloading '+downloadPct+'%':'Téléchargement '+downloadPct+'%'):(en?'Download':'Télécharger')}
              disabled={busy} onPress={()=>{void saveOffline();}}/>
          </View>
          <View style={styles.divider}/>
          <Text style={styles.section}>{en?'Reel options':'Options du Reel'}</Text>
          <Pressable style={styles.option} accessibilityRole="button" disabled={busy}
            onPress={onOpenDownloads}>
            <KnowMeIcon name="download" size={23} color="#eee"/>
            <Text style={styles.optionLabel}>{en?'My offline videos':'Mes vidéos hors ligne'}</Text>
          </Pressable>
          <Pressable style={styles.option} accessibilityRole="button" disabled={busy}
            onPress={onOpenPost}>
            <KnowMeIcon name="messages" size={23} color="#eee"/>
            <Text style={styles.optionLabel}>{en?'View original post':'Voir la publication'}</Text>
          </Pressable>
          <Pressable style={styles.option} accessibilityRole="button" disabled={busy}
            onPress={()=>{
              Alert.alert(en?'Hide this Reel?':'Masquer ce Reel ?',
                en?'It will disappear from this list until you reload. This does not change recommendations.':
                  'Il disparaîtra de cette liste jusqu’au rechargement. Cela ne modifie pas les recommandations.',[
                  {text:en?'Cancel':'Annuler',style:'cancel'},
                  {text:en?'Hide':'Masquer',onPress:onHide}
                ]);
            }}>
            <KnowMeIcon name="close" size={23} color="#eee"/>
            <Text style={styles.optionLabel}>{en?'Hide this Reel here':'Masquer ce Reel ici'}</Text>
          </Pressable>
          <Text style={styles.finePrint}>
            {en?'For direct link copying, use the copy option in Android’s system share menu.':
              'Pour copier le lien, utilise l’option de copie du menu de partage Android.'}
          </Text>
          {Boolean(notice)&&<Text accessibilityRole="text" style={styles.success}>{notice}</Text>}
          {Boolean(error)&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles=StyleSheet.create({
  layer:{flex:1,justifyContent:'flex-end'},
  scrim:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,.60)'},
  sheet:{height:'82%',maxHeight:720,backgroundColor:'#242426',
    borderTopLeftRadius:26,borderTopRightRadius:26,paddingTop:9,
    paddingBottom:Platform.OS==='ios'?22:25},
  handle:{width:48,height:5,borderRadius:99,backgroundColor:'#626267',
    alignSelf:'center',marginBottom:12},
  heading:{minHeight:49,flexDirection:'row',alignItems:'center',paddingHorizontal:16,
    justifyContent:'space-between'},
  headingSpacer:{width:44},
  title:{color:'#fff',fontSize:20,fontWeight:'800'},
  close:{width:44,height:44,alignItems:'center',justifyContent:'center'},
  body:{paddingHorizontal:20,paddingBottom:32,gap:12},
  search:{minHeight:48,flexDirection:'row',alignItems:'center',gap:10,
    backgroundColor:'#38383b',borderRadius:17,paddingHorizontal:13},
  searchInput:{flex:1,fontSize:15,color:'#fff',paddingVertical:8},
  recipients:{gap:14,paddingVertical:9},
  recipient:{width:80,alignItems:'center',gap:7,minHeight:109},
  avatar:{width:62,height:62,borderRadius:31,backgroundColor:'#444a59',
    alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:'transparent'},
  selectedAvatar:{borderColor:'#85e9df',backgroundColor:'#314a53'},
  avatarInitial:{fontSize:24,fontWeight:'800',color:'#fff'},
  checkBadge:{position:'absolute',bottom:-3,right:-2,width:21,height:21,
    borderRadius:11,backgroundColor:'#85e9df',alignItems:'center',justifyContent:'center'},
  recipientName:{color:'#fff',fontSize:12,textAlign:'center'},
  listMessage:{gap:9,paddingVertical:15},
  hint:{color:'#c4c4c6',fontSize:13,lineHeight:19},
  accent:{color:'#a4f5e9',fontSize:14,fontWeight:'700'},
  composer:{flexDirection:'row',gap:9,alignItems:'center'},
  note:{backgroundColor:'#363639',borderRadius:15,minHeight:46,maxHeight:100,
    flex:1,paddingHorizontal:12,paddingVertical:10,fontSize:14,color:'#fff'},
  send:{minHeight:46,paddingHorizontal:16,backgroundColor:'#91efe3',
    borderRadius:15,alignItems:'center',justifyContent:'center'},
  sendLabel:{fontWeight:'800',fontSize:14,color:'#102b2a'},
  disabled:{opacity:.5},
  divider:{height:1,backgroundColor:'#3e3e40',marginVertical:7},
  section:{color:'#ededee',fontSize:15,fontWeight:'800'},
  quickRow:{flexDirection:'row',justifyContent:'space-between',gap:6},
  quickAction:{width:'24%',alignItems:'center',gap:8,minHeight:105},
  pressed:{opacity:.72},
  quickCircle:{height:61,width:61,borderRadius:31,backgroundColor:'#3a3b40',
    justifyContent:'center',alignItems:'center'},
  quickLabel:{color:'#eee',fontSize:12,textAlign:'center',lineHeight:16},
  option:{minHeight:50,flexDirection:'row',alignItems:'center',gap:16,
    paddingHorizontal:10,borderRadius:13},
  optionLabel:{color:'#fff',fontSize:15,fontWeight:'600'},
  finePrint:{fontSize:11,lineHeight:17,color:'#a6a6aa',paddingHorizontal:5},
  error:{fontSize:13,color:'#ffb5b7',lineHeight:19},
  success:{fontSize:13,color:'#a4f5e9',lineHeight:19}
});
