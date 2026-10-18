import {useEffect,useRef,useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {KnowMeIcon} from './ui/KnowMeUI';
import {getChatAudioState,pauseChatAudio,resumeChatAudio,seekChatAudio,
 stopChatAudio,subscribeChatAudio,requireChatAudioOwner} from './chat-audio-session';

const fmt=(ms:number)=>{
 const n=Math.floor(Math.max(0,ms)/1000);
 return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;
};
/** Sticky shared voice player; mounted above conversations, not within bubbles. */
export function ChatAudioMiniBar({ownerId}:{ownerId:string}){
 const [state,setState]=useState(getChatAudioState);
 const width=useRef(1);
 useEffect(()=>subscribeChatAudio(setState),[]);
 useEffect(()=>{void requireChatAudioOwner(ownerId);},[ownerId]);
 if(!state.assetId||state.ownerId!==ownerId)return null;
 const progress=state.durationMs>0?Math.max(0,Math.min(1,state.positionMs/state.durationMs)):0;
 const playing=state.phase==='playing';
 const busy=state.phase==='downloading';
 return <View style={styles.root} accessibilityLabel="Lecture audio en cours">
   <View style={styles.top}>
     <KnowMeIcon name="microphone" size={18} color="#53bdeb"/>
     <View style={styles.context}>
       <Text numberOfLines={1} style={styles.title}>{state.sender||'Message vocal'}</Text>
       <Text numberOfLines={1} style={styles.origin}>{state.origin||'Conversation'} · {
         busy?(state.downloadFraction===null?'Téléchargement':
             `${Math.round(state.downloadFraction*100)} % téléchargé`):
         `${fmt(state.positionMs)} / ${fmt(state.durationMs)}`}</Text>
     </View>
     <Pressable accessibilityRole="button"
       disabled={busy||state.phase==='error'}
       accessibilityLabel={playing?'Mettre en pause':'Reprendre la lecture'}
       onPress={()=>void (playing?pauseChatAudio():resumeChatAudio())}
       style={styles.action}>
       <KnowMeIcon name={playing?'pause':'play'} size={19} color="#e9edef"/>
     </Pressable>
     <Pressable accessibilityRole="button" accessibilityLabel="Arrêter complètement le vocal"
       onPress={()=>void stopChatAudio()} style={styles.action}>
       <KnowMeIcon name="close" size={20} color="#e9edef"/>
     </Pressable>
   </View>
   <Pressable accessibilityRole="adjustable" accessibilityLabel="Progression du vocal"
     disabled={busy||state.durationMs<=0}
     accessibilityValue={{min:0,max:100,now:Math.round(progress*100)}}
     onLayout={event=>{width.current=event.nativeEvent.layout.width;}}
     onPress={event=>void seekChatAudio(event.nativeEvent.locationX/Math.max(1,width.current)*state.durationMs)}
     style={styles.seek}>
     <View style={[styles.progress,{width:`${progress*100}%` as `${number}%`}]}/>
   </Pressable>
   {state.error?<Text style={styles.error} role="alert">{state.error}</Text>:null}
 </View>;
}
const styles=StyleSheet.create({
 root:{backgroundColor:'#1b2934',borderBottomWidth:1,borderBottomColor:'#37454e'},
 top:{minHeight:54,flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:12},
 context:{flex:1,minWidth:0,gap:2},
 title:{color:'#e9edef',fontSize:12,fontWeight:'700'},
 origin:{color:'#93abb8',fontSize:10},
 action:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},
 seek:{width:'100%',height:9,justifyContent:'center',backgroundColor:'#31424e'},
 progress:{height:3,backgroundColor:'#53bdeb'},
 error:{fontSize:10,color:'#ffa9ad',paddingHorizontal:12,paddingBottom:4}
});
