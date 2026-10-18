import * as FileSystem from 'expo-file-system';
import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Pressable,StyleSheet,Text,View} from 'react-native';
import {API_URL} from './api';
import {NativeStoryVideo} from './NativeStoryVideo';
import {useAppearance} from './AppearanceProvider';
import {KnowMeIcon} from './ui/KnowMeUI';

/** On-demand playback. The native video component only accepts private cache files. */
export function PublicPostVideo({url}:{url:string}){
  const {colors}=useAppearance();
  const [local,setLocal]=useState<string|null>(null);
  const [loading,setLoading]=useState(false);
  const [paused,setPaused]=useState(false);
  const [error,setError]=useState('');
  const ref=useRef<string|null>(null);
  const pending=useRef(false);
  const alive=useRef(true);
  useEffect(()=>{
    alive.current=true;
    return()=>{
      alive.current=false;
      if(ref.current)void FileSystem.deleteAsync(ref.current,{idempotent:true}).catch(()=>undefined);
    };
  },[]);
  async function open(){
    if(pending.current||local)return;
    pending.current=true;setLoading(true);setError('');
    try{
      if(!/^\/media\/public\/post\/[a-zA-Z0-9_-]+$/.test(url)||!FileSystem.cacheDirectory)
        throw new Error('Vidéo indisponible.');
      const target=`${FileSystem.cacheDirectory}knowme-post-video-${url.split('/').pop()}.mp4`;
      const result=await FileSystem.downloadAsync(`${API_URL}${url}`,target);
      if(result.status!==200)throw new Error('Impossible de charger cette vidéo.');
      const info=await FileSystem.getInfoAsync(result.uri);
      if(!info.exists||!info.size||info.size<1024)
        throw new Error('Fichier vidéo invalide.');
      ref.current=result.uri;
      if(alive.current){setPaused(false);setLocal(result.uri);}
    }catch(cause){if(alive.current)setError(cause instanceof Error?cause.message:'Vidéo inaccessible.');}
    finally{pending.current=false;if(alive.current)setLoading(false);}
  }
  return <View style={styles.container}>
    {local?<View style={styles.playback}>
      <NativeStoryVideo sourceUri={local} paused={paused} style={styles.video}/>
      <Pressable style={styles.tapZone}
        accessibilityRole="button"
        accessibilityLabel={paused?'Reprendre la vidéo':'Mettre la vidéo en pause'}
        accessibilityState={{selected:paused}}
        onPress={()=>setPaused(value=>!value)}>
        {paused?<View style={styles.pausedIndicator}>
          <KnowMeIcon name="play" size={32} color="#fff"/>
        </View>:null}
      </Pressable>
    </View>:<Pressable
      accessibilityRole="button" accessibilityLabel="Lire la vidéo"
      onPress={()=>void open()} style={[styles.open,{backgroundColor:colors.surface}]}>
      {loading?<ActivityIndicator color={colors.accent}/>:
        <KnowMeIcon name="play" size={45} color={colors.text}/>}
      <Text style={{color:colors.muted,fontSize:12,textAlign:'center'}}>
        {loading?'Chargement de la vidéo…':error||'Lire la vidéo'}
      </Text>
    </Pressable>}
  </View>;
}
const styles=StyleSheet.create({
  container:{width:'100%',height:'100%',overflow:'hidden'},
  playback:{width:'100%',height:'100%'},
  video:{width:'100%',height:'100%'},
  tapZone:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center'},
  pausedIndicator:{width:68,height:68,borderRadius:25,backgroundColor:'rgba(0,0,0,.58)',
    alignItems:'center',justifyContent:'center'},
  open:{flex:1,alignItems:'center',justifyContent:'center',gap:9}
});
