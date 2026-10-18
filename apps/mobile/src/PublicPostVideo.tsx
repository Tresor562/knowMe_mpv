import {useEffect,useRef,useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {API_URL} from './api';
import {NativeStoryVideo} from './NativeStoryVideo';
import {useAppearance} from './AppearanceProvider';
import {KnowMeIcon} from './ui/KnowMeUI';
import {videoTime} from './video-time';

/** On-demand, HTTPS range-streamed public video. No full-file download. */
export function PublicPostVideo({url,onDoubleTap}:{url:string;onDoubleTap?:()=>void}){
  const {colors}=useAppearance();
  const [local,setLocal]=useState<string|null>(null);
  const [paused,setPaused]=useState(false);
  const [error,setError]=useState('');
  const [positionMs,setPositionMs]=useState(0);
  const [durationMs,setDurationMs]=useState(0);
  const [seekToMs,setSeekToMs]=useState<number|undefined>(undefined);
  const [trackWidth,setTrackWidth]=useState(1);
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
    if(!/^\/media\/public\/post\/[a-zA-Z0-9_-]{1,128}$/.test(url)
      ||API_URL!==allowedBase){
      setError('Vidéo indisponible ou serveur vidéo non pris en charge.');
      return;
    }
    setError('');
    setPaused(false);
    setPositionMs(0);
    setDurationMs(0);
    setSeekToMs(undefined);
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

  function seek(milliseconds:number){
    if(durationMs<=0)return;
    const bounded=Math.max(0,Math.min(durationMs,Math.floor(milliseconds)));
    setSeekToMs(bounded);
    setPositionMs(bounded);
  }
  return <View style={styles.container}>
    {local?<View style={styles.playback}>
      <NativeStoryVideo sourceUri={local} paused={paused} style={styles.video}
        seekToMs={seekToMs}
        onProgress={event=>{
          const duration=event.nativeEvent.durationMs;
          const position=event.nativeEvent.positionMs;
          if(Number.isFinite(duration)&&duration>0)setDurationMs(duration);
          if(Number.isFinite(position)&&position>=0)setPositionMs(position);
        }}/>
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
      <View style={[styles.seekControls,onDoubleTap?styles.reelSeek:null]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Reculer de dix secondes"
          onPress={()=>seek(positionMs-10000)} style={styles.skipButton}>
          <KnowMeIcon name="arrow" size={17} color="#fff"/>
          <Text style={styles.skipText}>-10</Text>
        </Pressable>
        <View style={styles.seekMiddle}>
          <Text style={styles.timeLabel}>{videoTime(positionMs)} / {videoTime(durationMs)}</Text>
          <Pressable accessibilityRole="adjustable"
            accessibilityLabel="Position dans la vidéo"
            accessibilityValue={{min:0,max:Math.max(1,Math.floor(durationMs/1000)),now:Math.min(Math.floor(positionMs/1000),Math.max(1,Math.floor(durationMs/1000)))}}
            accessibilityActions={[{name:'increment',label:'Avancer dix secondes'},{name:'decrement',label:'Reculer dix secondes'}]}
            onAccessibilityAction={event=>{
              if(event.nativeEvent.actionName==='increment')seek(positionMs+10000);
              else if(event.nativeEvent.actionName==='decrement')seek(positionMs-10000);
            }}
            onLayout={event=>setTrackWidth(Math.max(1,event.nativeEvent.layout.width))}
            onPress={event=>seek(durationMs*event.nativeEvent.locationX/trackWidth)}
            style={styles.seekTrack}>
            <View style={[styles.seekFill,{width:(durationMs>0?Math.min(100,100*positionMs/durationMs):0)+'%'}]}/>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Avancer de dix secondes"
          onPress={()=>seek(positionMs+10000)} style={styles.skipButton}>
          <KnowMeIcon name="arrow" size={17} color="#fff"/>
          <Text style={styles.skipText}>+10</Text>
        </Pressable>
      </View>
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
  seekControls:{position:'absolute',left:11,right:11,bottom:13,
    minHeight:50,paddingHorizontal:8,borderRadius:16,
    backgroundColor:'rgba(0,0,0,.68)',flexDirection:'row',
    alignItems:'center',gap:10},
  reelSeek:{bottom:205},
  skipButton:{width:42,minHeight:44,alignItems:'center',justifyContent:'center'},
  skipText:{color:'#fff',fontSize:10,fontWeight:'800'},
  seekMiddle:{flex:1,gap:7},
  timeLabel:{color:'#fff',fontSize:11,fontWeight:'700',fontVariant:['tabular-nums']},
  seekTrack:{height:18,borderRadius:9,backgroundColor:'rgba(255,255,255,.3)',
    justifyContent:'center',overflow:'hidden'},
  seekFill:{height:5,backgroundColor:'#83e9de',borderRadius:3},
  pausedIndicator:{width:68,height:68,borderRadius:25,backgroundColor:'rgba(0,0,0,.58)',
    alignItems:'center',justifyContent:'center'},
  likeIndicator:{width:94,height:94,borderRadius:32,
    backgroundColor:'rgba(0,0,0,.25)',alignItems:'center',justifyContent:'center'},
  open:{flex:1,alignItems:'center',justifyContent:'center',gap:9}
});
