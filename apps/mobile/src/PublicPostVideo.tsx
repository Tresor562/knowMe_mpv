import {useEffect,useRef,useState} from 'react';
import {Alert,KeyboardAvoidingView,Modal,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import * as FileSystem from 'expo-file-system';
import {API_URL} from './api';
import {NativeStoryVideo} from './NativeStoryVideo';
import {useAppearance} from './AppearanceProvider';
import {useI18n} from './I18nProvider';
import {KnowMeIcon} from './ui/KnowMeUI';
import {videoTime,seekTimeFromTrack,clampVideoSeek,parseVideoTimestamp,videoTapIntent} from './video-time';
import {publicPostVideoId} from './offline-public-video-model';
import {getPublicVideoResume,savePublicVideoResume} from './video-resume-store';
import {savedPublicVideo,downloadPublicVideoOffline,deleteSavedPublicVideo} from './offline-public-video';

/** On-demand, HTTPS range-streamed public video. No full-file download. */
export function PublicPostVideo({url,onDoubleTap,autoPlay=false,externallyPaused=false,
  offlineRequest=0,onOfflineStatus}:{
  url:string;onDoubleTap?:()=>void;autoPlay?:boolean;externallyPaused?:boolean;
  offlineRequest?:number;onOfflineStatus?:(saved:boolean)=>void
}){
  const {colors}=useAppearance();
  const {locale}=useI18n();
  const en=locale==='en';
  const [local,setLocal]=useState<string|null>(null);
  const [paused,setPaused]=useState(false);
  const [ended,setEnded]=useState(false);
  const [error,setError]=useState('');
  const [positionMs,setPositionMs]=useState(0);
  const [durationMs,setDurationMs]=useState(0);
  const [seekToMs,setSeekToMs]=useState<number|undefined>(undefined);
  const [resumeMs,setResumeMs]=useState<number|null>(null);
  const playback=useRef({positionMs:0,durationMs:0,checkpointAt:0,completed:false});
  const [trackWidth,setTrackWidth]=useState(1);
  const [scrubMs,setScrubMs]=useState<number|null>(null);
  const [timeDialogOpen,setTimeDialogOpen]=useState(false);
  const [timeInput,setTimeInput]=useState('');
  const [timeError,setTimeError]=useState(false);
  const scrubbing=useRef(false);
  const [saved,setSaved]=useState<string|null>(null);
  const [saving,setSaving]=useState(false);
  const [savePercent,setSavePercent]=useState(0);
  const [saveNotice,setSaveNotice]=useState('');
  const activeDownload=useRef<FileSystem.DownloadResumable|null>(null);
  const alive=useRef(true);
  const singleTapTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [pulse,setPulse]=useState(false);
  const pulseTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  // Reels use transient controls; shared feed previews keep their normal controls.
  const [reelControlsVisible,setReelControlsVisible]=useState(false);
  const controlsTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const previousOfflineRequest=useRef(offlineRequest);
  useEffect(()=>{
    alive.current=true;
    return()=>{
      alive.current=false;
      if(activeDownload.current)void activeDownload.current.pauseAsync().catch(()=>undefined);
      if(singleTapTimer.current!==null)clearTimeout(singleTapTimer.current);
      if(pulseTimer.current!==null)clearTimeout(pulseTimer.current);
      if(controlsTimer.current!==null)clearTimeout(controlsTimer.current);
      const last=playback.current;
      if(last.durationMs>0)void savePublicVideoResume(url,last.positionMs,last.durationMs).catch(()=>undefined);
    };
  },[url]);
  useEffect(()=>{
    let cancelled=false;
    setSaved(null);
    void savedPublicVideo(url).then(uri=>{
      if(!cancelled)setSaved(uri);
    }).catch(()=>undefined);
    return()=>{cancelled=true;};
  },[url]);

  async function manageOfflineCopy(){
    if(saving)return;
    if(saved){
      Alert.alert('Supprimer la vidéo enregistrée',
        'Elle sera retirée de cet appareil, sans supprimer la publication.',
        [{text:'Annuler',style:'cancel'},{
          text:'Supprimer',style:'destructive',
          onPress:()=>{void (async()=>{
            await deleteSavedPublicVideo(url);
            if(!alive.current)return;
            if(local===saved)setLocal(null);
            setSaved(null);
            setSaveNotice('Vidéo supprimée de cet appareil.');
          })().catch(()=>{if(alive.current)setSaveNotice('Suppression impossible.');});}
        }]);
      return;
    }
    if(!publicPostVideoId(url)){
      setSaveNotice('Seules les vidéos publiques KnowMe peuvent être enregistrées.');
      return;
    }
    setSaving(true);setSavePercent(0);setSaveNotice('');
    try{
      const uri=await downloadPublicVideoOffline(url,fraction=>{
        if(alive.current)setSavePercent(Math.round(fraction*100));
      },task=>{activeDownload.current=task;});
      if(alive.current){
        setSaved(uri);
        setSaveNotice('Vidéo enregistrée. Elle reste disponible hors connexion.');
      }
    }catch(error){
      if(alive.current)setSaveNotice(error instanceof Error?error.message:
        'Téléchargement interrompu.');
    }finally{
      activeDownload.current=null;
      if(alive.current)setSaving(false);
    }
  }

  useEffect(()=>{
    if(previousOfflineRequest.current===offlineRequest)return;
    previousOfflineRequest.current=offlineRequest;
    if(onDoubleTap)void manageOfflineCopy();
  // The request changes only after an explicit press in the Reels side rail.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[offlineRequest]);
  useEffect(()=>{onOfflineStatus?.(Boolean(saved));
  // The state transition is authoritative; callback identity is not a trigger.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[saved]);

  async function open(){
    // Do not copy an entire MP4 into cache. Android VideoView reads bounded
    // HTTP ranges from the public, scanner-verified KnowMe post endpoint.
    // The native package applies an independent host/path allowlist.
    const allowedBase='https://31-56-85-53.sslip.io/knowme-api';
    if(!publicPostVideoId(url)||API_URL!==allowedBase){
      setError('Vidéo indisponible ou serveur vidéo non pris en charge.');
      return;
    }
    setError('');
    setPaused(false);
    setEnded(false);
    setPositionMs(0);
    setDurationMs(0);
    setSeekToMs(undefined);
    playback.current={positionMs:0,durationMs:0,checkpointAt:0,completed:false};
    setResumeMs(null);
    const [offline,resume]=await Promise.all([
      savedPublicVideo(url).catch(()=>null),
      getPublicVideoResume(url).catch(()=>null)
    ]);
    if(alive.current){
      if(offline)setSaved(offline);
      setResumeMs(resume);
      setLocal(offline??API_URL+url);
    }
  }
  // Autoplay only when the caller explicitly marks a single active Reel.
  // Feed previews and the offline-library thumbnail remain tap-to-play.
  useEffect(()=>{
    if(autoPlay)void open();
  },[autoPlay,url]);

  function replayFromBeginning(){
    if(durationMs<=0)return;
    seek(0);
    setPaused(false);
  }
  function togglePlayback(){
    if(videoTapIntent(ended,paused)==='replay'){
      replayFromBeginning();
      return;
    }
    setPaused(value=>videoTapIntent(false,value)==='pause');
  }
  function revealReelControls(){
    if(onDoubleTap)setReelControlsVisible(true);
  }
  useEffect(()=>{
    if(!onDoubleTap)return;
    if(controlsTimer.current!==null)clearTimeout(controlsTimer.current);
    if(reelControlsVisible&&!paused&&scrubMs===null&&!timeDialogOpen&&!ended){
      controlsTimer.current=setTimeout(()=>setReelControlsVisible(false),3000);
    }
    return()=>{if(controlsTimer.current!==null)clearTimeout(controlsTimer.current);};
  },[onDoubleTap,reelControlsVisible,paused,scrubMs,timeDialogOpen,ended]);
  function tapVideo(){
    revealReelControls();
    if (!onDoubleTap) {
      togglePlayback();
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
      togglePlayback();
    },260);
  }

  function seek(milliseconds:number){
    if(durationMs<=0)return;
    const bounded=clampVideoSeek(milliseconds,durationMs);
    setSeekToMs(bounded);
    setPositionMs(bounded);
    setEnded(false);
    setResumeMs(null);
    playback.current.positionMs=bounded;
    if(playback.current.durationMs>0)void savePublicVideoResume(url,bounded,playback.current.durationMs).catch(()=>undefined);
  }
  function confirmTimestamp(){
    const target=parseVideoTimestamp(timeInput,durationMs);
    if(target===null){setTimeError(true);return;}
    seek(target);
    setTimeDialogOpen(false);
    setTimeError(false);
  }
  const displayMs=scrubMs??positionMs;
  const displayPercent=durationMs>0?Math.min(100,100*displayMs/durationMs):0;
  function dragSeek(offsetX:number){
    if(durationMs<=0)return;
    scrubbing.current=true;
    setScrubMs(seekTimeFromTrack(durationMs,offsetX,trackWidth));
  }
  function completeSeek(offsetX:number){
    if(!scrubbing.current)return;
    const target=seekTimeFromTrack(durationMs,offsetX,trackWidth);
    scrubbing.current=false;
    setScrubMs(null);
    seek(target);
  }
  return <View style={styles.container}>
    {local?<View style={styles.playback}>
      <NativeStoryVideo sourceUri={local} paused={paused||externallyPaused||scrubMs!==null||timeDialogOpen} style={styles.video}
        onPlaybackError={event=>{
          setLocal(null);
          setError(event.nativeEvent.message||'Lecture de la vidéo impossible.');
        }}
        onPlaybackComplete={event=>{
          const completedDuration=event.nativeEvent.durationMs||durationMs;
          setSeekToMs(undefined);
          setPositionMs(completedDuration);
          setEnded(true);
          setPaused(true);
          setResumeMs(null);
          if(completedDuration>0)
            void savePublicVideoResume(url,completedDuration,completedDuration).catch(()=>undefined);
        }}
        seekToMs={seekToMs}
        onProgress={event=>{
          const duration=event.nativeEvent.durationMs;
          const position=event.nativeEvent.positionMs;
          if(Number.isFinite(duration)&&duration>0)setDurationMs(duration);
          if(Number.isFinite(position)&&position>=0&&!scrubbing.current)setPositionMs(position);
          if(Number.isFinite(duration)&&duration>0&&Number.isFinite(position)&&position>=0){
            const current=playback.current;
            current.positionMs=position;
            current.durationMs=duration;
            const completed=position>=duration-15000||position>=duration*.95;
            const now=Date.now();
            if(now-current.checkpointAt>=15000||completed&&!current.completed){
              current.checkpointAt=now;
              current.completed=completed;
              void savePublicVideoResume(url,position,duration).catch(()=>undefined);
            }
            if(position>12000&&resumeMs!==null)setResumeMs(null);
          }
        }}/>
      <Pressable style={styles.tapZone}
        accessibilityRole="button"
        accessibilityLabel={paused?'Reprendre la vidéo':'Mettre la vidéo en pause'}
        accessibilityState={{selected:paused}}
        onPress={tapVideo}>
        {pulse?<View style={styles.likeIndicator} pointerEvents="none">
          <KnowMeIcon name="heart" size={65} color="#ff5776"/>
        </View>:null}
        {paused&&!pulse&&!ended&&!onDoubleTap?<View style={styles.pausedIndicator}>
          <KnowMeIcon name="play" size={32} color="#fff"/>
        </View>:null}
      </Pressable>
      {onDoubleTap&&(reelControlsVisible||paused)&&!ended&&<View style={styles.reelCenterControls}>
        <Pressable accessibilityRole="button" accessibilityLabel={en?'Back ten seconds':'Reculer de 10 secondes'}
          style={styles.reelCircleSmall} onPress={()=>{seek(positionMs-10000);revealReelControls();}}>
          <Text style={styles.reelSkipLabel}>↶10</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={paused?(en?'Play':'Lecture'):(en?'Pause':'Pause')}
          style={styles.reelCircleMain} onPress={()=>{togglePlayback();revealReelControls();}}>
          <KnowMeIcon name={paused?'play':'pause'} size={30} color="#fff"/>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={en?'Forward ten seconds':'Avancer de 10 secondes'}
          style={styles.reelCircleSmall} onPress={()=>{seek(positionMs+10000);revealReelControls();}}>
          <Text style={styles.reelSkipLabel}>10↷</Text>
        </Pressable>
      </View>}
      {ended&&<Pressable accessibilityRole="button"
        accessibilityLabel={en?'Watch the video again':'Revoir la vidéo depuis le début'}
        onPress={replayFromBeginning} style={styles.replayButton}>
        <KnowMeIcon name="refresh" size={21} color="#072e2a"/>
        <Text style={styles.replayText}>{en?'Watch again':'Revoir'}</Text>
      </Pressable>}
      {(!onDoubleTap||reelControlsVisible||paused||scrubMs!==null||timeDialogOpen)&&
      <View style={[styles.seekControls,onDoubleTap?styles.reelSeek:null]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Reculer de dix secondes"
          onPress={()=>seek(clampVideoSeek(positionMs,durationMs,-10000))} style={styles.skipButton}>
          <KnowMeIcon name="arrow" size={17} color="#fff"/>
          <Text style={styles.skipText}>-10</Text>
        </Pressable>
        <View style={styles.seekMiddle}>
          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>{videoTime(displayMs)} / {videoTime(durationMs)}{scrubMs!==null?' · déplacer':''}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={en?'Go to a precise time':'Aller à un minutage précis'}
              disabled={durationMs<=0}
              onPress={()=>{
                setTimeInput(videoTime(positionMs));
                setTimeError(false);
                setTimeDialogOpen(true);
              }} style={styles.timeJump}>
              <Text style={styles.timeJumpLabel}>{en?'Go to…':'Aller à…'}</Text>
            </Pressable>
          </View>
          <View accessible accessibilityRole="adjustable"
            accessibilityLabel="Position dans la vidéo"
            accessibilityValue={{min:0,max:Math.max(1,Math.floor(durationMs/1000)),now:Math.min(Math.floor(positionMs/1000),Math.max(1,Math.floor(durationMs/1000)))}}
            accessibilityActions={[{name:'increment',label:'Avancer dix secondes'},{name:'decrement',label:'Reculer dix secondes'}]}
            onAccessibilityAction={event=>{
              if(event.nativeEvent.actionName==='increment')seek(positionMs+10000);
              else if(event.nativeEvent.actionName==='decrement')seek(positionMs-10000);
            }}
            onLayout={event=>setTrackWidth(Math.max(1,event.nativeEvent.layout.width))}
            onStartShouldSetResponder={()=>durationMs>0}
            onMoveShouldSetResponder={()=>durationMs>0}
            onResponderGrant={event=>dragSeek(event.nativeEvent.locationX)}
            onResponderMove={event=>dragSeek(event.nativeEvent.locationX)}
            onResponderRelease={event=>completeSeek(event.nativeEvent.locationX)}
            onResponderTerminate={()=>{scrubbing.current=false;setScrubMs(null);}}
            onResponderTerminationRequest={()=>false}
            style={styles.seekTrack}>
            <View pointerEvents="none" style={[styles.seekFill,{width:`${displayPercent}%` as `${number}%`}]}/>
            <View pointerEvents="none" style={[styles.seekThumb,{left:`${displayPercent}%` as `${number}%`}]}/>
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Avancer de dix secondes"
          onPress={()=>seek(clampVideoSeek(positionMs,durationMs,10000))} style={styles.skipButton}>
          <KnowMeIcon name="arrow" size={17} color="#fff"/>
          <Text style={styles.skipText}>+10</Text>
        </Pressable>
      </View>}
      {Boolean(onDoubleTap)&&durationMs>=180000&&!reelControlsVisible&&!paused&&scrubMs===null&&
        <Pressable style={styles.reelThinTrack} accessibilityRole="button"
          accessibilityLabel={en?'Show video progress':'Afficher la progression'}
          onPress={revealReelControls}>
          <View pointerEvents="none" style={[styles.reelThinFill,{width:`${displayPercent}%` as `${number}%`}]}/>
        </Pressable>}
      {resumeMs!==null&&durationMs>0&&positionMs<12000&&
        <View style={[styles.resumeBox,onDoubleTap?styles.resumeReel:null]}>
          <Pressable accessibilityRole="button" style={styles.resumeButton}
            accessibilityLabel={en?'Resume from '+videoTime(resumeMs):'Reprendre à '+videoTime(resumeMs)}
            onPress={()=>seek(resumeMs)}>
            <KnowMeIcon name="play" size={18} color="#08312c"/>
            <Text style={styles.resumeLabel}>
              {en?'Resume '+videoTime(resumeMs):'Reprendre '+videoTime(resumeMs)}
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.resumeClose}
            accessibilityLabel={en?'Continue from the start':'Continuer depuis le début'}
            onPress={()=>{
              setResumeMs(null);
              // Starting over is an explicit choice: don't re-prompt with the
              // former bookmark the next time the user opens this video.
              void savePublicVideoResume(url,durationMs,durationMs).catch(()=>undefined);
            }}>
            <KnowMeIcon name="close" size={18} color="#fff"/>
          </Pressable>
        </View>}
    </View>:<Pressable
      accessibilityRole="button" accessibilityLabel="Lire la vidéo"
      onPress={()=>void open()} style={[styles.open,{backgroundColor:colors.surface}]}>
      <KnowMeIcon name="play" size={45} color={colors.text}/>
      <Text style={{color:colors.muted,fontSize:12,textAlign:'center'}}>
        {error||'Lire la vidéo'}
      </Text>
    </Pressable>}
    {!onDoubleTap&&<View style={styles.offlineSaveBox}>
      <Pressable accessibilityRole="button"
        accessibilityLabel={saving?'Enregistrement de la vidéo en cours':saved?'Supprimer la vidéo enregistrée':'Enregistrer la vidéo hors ligne'}
        disabled={saving} onPress={()=>void manageOfflineCopy()}
        style={styles.offlineSaveButton}>
        <KnowMeIcon name={saved?'check':'download'} size={19} color="#fff"/>
        <Text style={styles.offlineSaveLabel}>
          {saving?'Enregistrement '+savePercent+' %':saved?'Enregistrée':'Hors ligne'}
        </Text>
      </Pressable>
      {Boolean(saveNotice)&&<Text accessibilityRole="text" style={styles.offlineNotice}>
        {saveNotice}
      </Text>}
    </View>}
    <Modal visible={timeDialogOpen} transparent animationType="fade"
      onRequestClose={()=>setTimeDialogOpen(false)} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={styles.timeModalFull}>
        <Pressable style={StyleSheet.absoluteFillObject}
          accessibilityRole="button" accessibilityLabel={en?'Close time entry':'Fermer la saisie du temps'}
          onPress={()=>setTimeDialogOpen(false)}/>
        <View style={styles.timeModalCard}>
          <Text style={styles.timeModalTitle}>{en?'Go to time':'Aller à un instant'}</Text>
          <Text style={styles.timeModalHint}>
            {en?'Enter seconds, mm:ss or h:mm:ss':'Entre les secondes, mm:ss ou h:mm:ss'}
            {' · '}{videoTime(durationMs)}
          </Text>
          <TextInput value={timeInput} onChangeText={value=>{
              setTimeInput(value);if(timeError)setTimeError(false);
            }}
            autoFocus autoCapitalize="none" autoCorrect={false} maxLength={20}
            returnKeyType="go" onSubmitEditing={confirmTimestamp}
            accessibilityLabel={en?'Target playback time':'Temps de lecture cible'}
            placeholder="2:14:30" placeholderTextColor="#92a5ac"
            selectionColor="#83e9de" style={styles.timeModalInput}/>
          {timeError&&<Text accessibilityRole="alert" style={styles.timeModalError}>
            {en?'Invalid time. Example: 2:14:30':'Temps invalide. Exemple : 2:14:30'}
          </Text>}
          <View style={styles.timeModalActions}>
            <Pressable accessibilityRole="button" onPress={()=>setTimeDialogOpen(false)}
              style={[styles.timeModalButton,styles.timeCancel]}>
              <Text style={styles.timeCancelText}>{en?'Cancel':'Annuler'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={confirmTimestamp}
              style={[styles.timeModalButton,styles.timeConfirm]}>
              <Text style={styles.timeConfirmText}>{en?'Go':'Aller'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  reelSeek:{bottom:139,left:16,right:16,backgroundColor:'rgba(0,0,0,.47)'},
  reelThinTrack:{position:'absolute',left:18,right:18,bottom:154,height:12,
    borderRadius:6,backgroundColor:'rgba(255,255,255,.18)',justifyContent:'center'},
  reelThinFill:{height:3,backgroundColor:'#53ede1',borderRadius:2},
  reelCenterControls:{position:'absolute',top:'43%',left:0,right:0,alignItems:'center',
    justifyContent:'center',flexDirection:'row',gap:16},
  reelCircleMain:{width:68,height:68,borderRadius:34,backgroundColor:'rgba(0,0,0,.6)',
    alignItems:'center',justifyContent:'center'},
  reelCircleSmall:{width:50,height:50,borderRadius:25,backgroundColor:'rgba(0,0,0,.54)',
    alignItems:'center',justifyContent:'center'},
  reelSkipLabel:{fontSize:17,fontWeight:'700',color:'#fff'},
  resumeBox:{position:'absolute',bottom:71,alignSelf:'center',flexDirection:'row',
    backgroundColor:'rgba(4,20,24,.9)',borderRadius:16,padding:4,alignItems:'center',gap:4},
  resumeReel:{bottom:262},
  resumeButton:{minHeight:44,flexDirection:'row',alignItems:'center',paddingHorizontal:12,
    gap:7,backgroundColor:'#83e9de',borderRadius:12},
  resumeLabel:{fontSize:12,color:'#08312c',fontWeight:'800'},
  resumeClose:{width:44,height:44,alignItems:'center',justifyContent:'center'},
  skipButton:{width:42,minHeight:44,alignItems:'center',justifyContent:'center'},
  skipText:{color:'#fff',fontSize:10,fontWeight:'800'},
  seekMiddle:{flex:1,gap:7},
  timeRow:{flexDirection:'row',flexWrap:'wrap',gap:4,alignItems:'center'},
  timeJump:{minHeight:44,minWidth:60,justifyContent:'center',alignItems:'center',borderRadius:10,
    paddingHorizontal:4},
  timeJumpLabel:{fontSize:10,fontWeight:'800',color:'#b4fff4'},
  timeLabel:{color:'#fff',fontSize:11,fontWeight:'700',fontVariant:['tabular-nums']},
  seekTrack:{height:18,borderRadius:9,backgroundColor:'rgba(255,255,255,.3)',
    justifyContent:'center',overflow:'hidden'},
  seekFill:{height:5,backgroundColor:'#83e9de',borderRadius:3},
  seekThumb:{position:'absolute',width:12,height:12,borderRadius:6,
    backgroundColor:'#fff',borderWidth:2,borderColor:'#83e9de',
    top:3,marginLeft:-6},
  pausedIndicator:{width:68,height:68,borderRadius:25,backgroundColor:'rgba(0,0,0,.58)',
    alignItems:'center',justifyContent:'center'},
  replayButton:{position:'absolute',top:'46%',alignSelf:'center',flexDirection:'row',
    alignItems:'center',justifyContent:'center',gap:8,minHeight:48,
    paddingHorizontal:18,borderRadius:16,backgroundColor:'#83e9de'},
  replayText:{fontSize:14,fontWeight:'800',color:'#072e2a'},
  likeIndicator:{width:94,height:94,borderRadius:32,
    backgroundColor:'rgba(0,0,0,.25)',alignItems:'center',justifyContent:'center'},
  offlineSaveBox:{position:'absolute',right:9,top:11,
    alignItems:'flex-end',maxWidth:'70%',gap:5},
  offlineSaveButton:{minHeight:44,flexDirection:'row',alignItems:'center',
    justifyContent:'center',gap:7,paddingHorizontal:12,borderRadius:17,
    backgroundColor:'rgba(0,0,0,.74)'},
  offlineSaveLabel:{fontSize:12,fontWeight:'800',color:'#fff'},
  offlineNotice:{fontSize:11,lineHeight:15,color:'#fff',padding:8,
    borderRadius:9,backgroundColor:'rgba(0,0,0,.76)',overflow:'hidden'},
  timeModalFull:{flex:1,alignItems:'center',justifyContent:'center',
    paddingHorizontal:18,backgroundColor:'rgba(0,0,0,.72)'},
  timeModalCard:{width:'100%',maxWidth:380,borderRadius:25,padding:20,gap:12,
    backgroundColor:'#192329',borderWidth:1,borderColor:'#3e5960'},
  timeModalTitle:{fontSize:20,fontWeight:'800',color:'#fff'},
  timeModalHint:{fontSize:12,lineHeight:18,color:'#b5ced2'},
  timeModalInput:{minHeight:52,borderRadius:14,paddingHorizontal:15,borderWidth:1,
    borderColor:'#4b676a',color:'#fff',backgroundColor:'#0d171d',
    fontVariant:['tabular-nums'],fontSize:22,fontWeight:'700'},
  timeModalError:{fontSize:12,color:'#ffb9be'},
  timeModalActions:{flexDirection:'row',gap:10},
  timeModalButton:{flex:1,minHeight:48,borderRadius:14,alignItems:'center',justifyContent:'center'},
  timeCancel:{backgroundColor:'#324148'},timeConfirm:{backgroundColor:'#83e9de'},
  timeCancelText:{fontSize:14,fontWeight:'700',color:'#fff'},
  timeConfirmText:{fontSize:14,fontWeight:'800',color:'#082f2b'},
  open:{flex:1,alignItems:'center',justifyContent:'center',gap:9}
});
