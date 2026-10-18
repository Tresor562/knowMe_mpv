import {useEffect,useRef,useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {API_URL} from './api';
import {NativeStoryVideo} from './NativeStoryVideo';
import {useAppearance} from './AppearanceProvider';
import {KnowMeIcon} from './ui/KnowMeUI';

/** On-demand, HTTPS range-streamed public video. No full-file download. */
export function PublicPostVideo({url,onDoubleTap}:{url:string;onDoubleTap?:()=>void}){
  const {colors}=useAppearance();
  const [local,setLocal]=useState<string|null>(null);
  const [paused,setPaused]=useState(false);
  const [error,setError]=useState('');
  const alive=useRef(true);
  const singleTapTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [pulse,setPulse]=useState(false);
  const pulseTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{
    alive.current=true;
    return()=>{
      alive.current=false;
      if(singleTapTimer.current!==null)clearTimeout(singleTapTimer.current);
      if(pulseTimer.current!==null)clearTimeout(pulseTimer.current);
    };
  },[]);
  function open(){
    // Do not copy an entire MP4 into cache. Android VideoView reads bounded
    // HTTP ranges from the public, scanner-verified KnowMe post endpoint.
    // The native package applies an independent host/path allowlist.
    const allowedBase='https://31-56-85-53.sslip.io/knowme-api';
    if(!/^\\/media\\/public\\/post\\/[a-zA-Z0-9_-]{1,128}$/.test(url)
      ||API_URL!==allowedBase){
      setError('Vidéo indisponible ou serveur vidéo non pris en charge.');
      return;
    }
    setError('');
    setPaused(false);
    setLocal(API_URL+url);
  }
  function tapVideo(){
    if (!onDoubleTap) {
      setPaused(value=>!value);
      return;
    }
    if (singleTapTimer.current!==null) {
      clearTimeout(singleTapTimer.current);
      singleTapTimer.current=null;
      onDoubleTap();
      setPulse(true);
      if(pulseTimer.current!==null)clearTimeout(pulseTimer.current);
      pulseTimer.current=setTimeout(()=>setPulse(false),520);
      return;
    }
    // Delay one tap just enough to distinguish it from a double tap.
    // A double tap must react once without toggling pause twice.
    singleTapTimer.current=setTimeout(()=>{
      singleTapTimer.current=null;
      setPaused(value=>!value);
    },260);
  }

  return <View style={styles.container}>
    {local?<View style={styles.playback}>
      <NativeStoryVideo sourceUri={local} paused={paused} style={styles.video}/>
      <Pressable style={styles.tapZone}
        accessibilityRole="button"
        accessibilityLabel={paused?'Reprendre la vidéo':'Mettre la vidéo en pause'}
        accessibilityState={{selected:paused}}
        onPress={tapVideo}>
        {pulse?<View style={styles.likeIndicator} pointerEvents="none">
          <KnowMeIcon name="heart" size={65} color="#ff5776"/>
        </View>:null}
        {paused&&!pulse?<View style={styles.pausedIndicator}>
          <KnowMeIcon name="play" size={32} color="#fff"/>
        </View>:null}
      </Pressable>
    </View>:<Pressable
      accessibilityRole="button" accessibilityLabel="Lire la vidéo"
      onPress={open} style={[styles.open,{backgroundColor:colors.surface}]}>
      <KnowMeIcon name="play" size={45} color={colors.text}/>
      <Text style={{color:colors.muted,fontSize:12,textAlign:'center'}}>
        {error||'Lire la vidéo'}
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
  likeIndicator:{width:94,height:94,borderRadius:32,
    backgroundColor:'rgba(0,0,0,.25)',alignItems:'center',justifyContent:'center'},
  open:{flex:1,alignItems:'center',justifyContent:'center',gap:9}
});
