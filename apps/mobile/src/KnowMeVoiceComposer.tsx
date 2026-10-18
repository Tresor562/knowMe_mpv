import {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, AppState, Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import type {RecordedKnowMeVoice} from './native-voice';
import {cancelKnowMeVoice,discardKnowMeVoice,getKnowMeVoicePlaybackStatus,playKnowMeVoice,
  seekKnowMeVoicePlayback,startKnowMeVoice,stopKnowMeVoice,stopKnowMeVoicePlayback} from './native-voice';
import {shouldCancelNativeCaptureOnUnmount,shouldDiscardVoiceOnUnmount,
  voiceClock,voiceProgress,voiceSeekMs,voiceUiState,type VoicePhase} from './voice-composer-model';
import {useI18n} from './I18nProvider';
import {KnowMeAlert as Alert} from './ui/KnowMeFeedback';
import {useAppearance} from './AppearanceProvider';
import {KnowMeIcon, PressScale} from './ui/KnowMeUI';

type Phase=VoicePhase;
const MAX_SECONDS=56; // stop before the native 60-second media-recorder safety limit

export function KnowMeVoiceComposer({busy,onSend,referenceChat=false}:{
  busy:boolean;
  onSend:(file:RecordedKnowMeVoice)=>Promise<boolean>;
  referenceChat?:boolean;
}) {
  const {colors}=useAppearance();
  const {locale}=useI18n();
  const en=locale==='en';
  const copy=en?{
    record:'Record a voice message',heading:'Voice message',cancel:'Discard voice message',
    unavailable:'Voice recording unavailable',missingMic:'The microphone is temporarily unavailable.',
    recording:'Recording… Finish to review before sending.',
    preview:'Ready to send. Listen first or discard it; nothing sends automatically.',
    sending:'Sending securely…',starting:'Preparing microphone…',finish:'Finish recording',
    listen:'Listen',stop:'Stop playback',send:'Send voice message',discard:'Discard recording',
    max:'Maximum recording length: 56 seconds.',seek:'Seek in the voice message',progress:'Playback position'
  }: {
    record:'Enregistrer un message vocal',heading:'Message vocal',cancel:'Supprimer ce vocal',
    unavailable:'Note vocale indisponible',missingMic:'Le microphone est temporairement indisponible.',
    recording:'Enregistrement… Termine pour vérifier avant tout envoi.',
    preview:'Prêt à envoyer. Écoute ou supprime : aucun envoi automatique.',
    sending:'Envoi sécurisé…',starting:'Préparation du microphone…',finish:'Terminer l’enregistrement',
    listen:'Écouter',stop:'Arrêter la lecture',send:'Envoyer le vocal',discard:'Supprimer l’enregistrement',
    max:'Durée maximale de l’enregistrement : 56 secondes.',seek:'Avancer ou reculer dans le vocal',progress:'Position de lecture'
  };
  const [phase,setPhase]=useState<Phase>('idle');
  const [seconds,setSeconds]=useState(0);
  const [recorded,setRecorded]=useState<RecordedKnowMeVoice|null>(null);
  const [open,setOpen]=useState(false);
  const [previewPlaying,setPreviewPlaying]=useState(false);
  const [playbackBusy,setPlaybackBusy]=useState(false);
  const [positionMs,setPositionMs]=useState(0);
  const [canSeek,setCanSeek]=useState(false);
  const seekWidth=useRef(0);
  const phaseRef=useRef<Phase>('idle');
  const mountedRef=useRef(true);
  const capturedRef=useRef<RecordedKnowMeVoice|null>(null);
  const startedAt=useRef(0);
  function next(value:Phase){phaseRef.current=value;setPhase(value);}
  const actions=voiceUiState(phase,busy);
  useEffect(()=>{
    if(phase!=='recording')return;
    const interval=setInterval(()=>{
      const elapsed=Math.floor((Date.now()-startedAt.current)/1000);
      setSeconds(elapsed);
      if(elapsed>=MAX_SECONDS)void finish();
    },250);
    return ()=>clearInterval(interval);
  },[phase]);

  useEffect(()=>{
    if(phase!=='preview'||!previewPlaying)return;
    // Older native APKs do not have playbackStatus; users can still stop manually.
    const interval=setInterval(()=>{
      void getKnowMeVoicePlaybackStatus().then(status=>{
        if(!status||phaseRef.current!=='preview')return;
        if(status.uri!==capturedRef.current?.uri){
          setPreviewPlaying(false);
          return;
        }
        setCanSeek(true);
        setPositionMs(Math.max(0,status.positionMs));
        if(!status.playing)setPreviewPlaying(false);
      }).catch(()=>setPreviewPlaying(false));
    },700);
    return ()=>clearInterval(interval);
  },[phase,previewPlaying]);

  useEffect(()=>{
    mountedRef.current=true;
    return ()=>{
      mountedRef.current=false;
      const previous=phaseRef.current;
      phaseRef.current='idle';
      if(shouldCancelNativeCaptureOnUnmount(previous)){
        void cancelKnowMeVoice().catch(()=>undefined);
      }
      // A confirmed upload must retain its file until onSend completes.
      // Other local previews are discarded on navigation/unmount.
      const file=capturedRef.current;
      if(file&&shouldDiscardVoiceOnUnmount(previous))void discardKnowMeVoice(file.uri).catch(()=>undefined);
      void stopKnowMeVoicePlayback().catch(()=>undefined);
    };
  },[]);

  function showError(error:unknown){
    if(!mountedRef.current)return;
    Alert.alert(copy.unavailable,
      error instanceof Error?error.message:copy.missingMic);
  }

  async function begin(){
    if(!voiceUiState(phaseRef.current,busy).canStart)return;
    setOpen(true);setSeconds(0);next('starting');
    try{
      await startKnowMeVoice();
      // The permission request is asynchronous: a close can change the phase.
      if (!mountedRef.current||(phaseRef.current as Phase)!=='starting'||
          AppState.currentState==='background') {
        await cancelKnowMeVoice().catch(()=>undefined);
        if(mountedRef.current){next('idle');setOpen(false);}
        return;
      }
      startedAt.current=Date.now();
      next('recording');
    }catch(e){
      if(!mountedRef.current){
        await cancelKnowMeVoice().catch(()=>undefined);
        return;
      }
      next('idle');setOpen(false);showError(e);
    }
  }
  async function finish(){
    if(!voiceUiState(phaseRef.current,busy).canFinish)return;
    next('stopping');
    try {
      const file=await stopKnowMeVoice();
      if(!mountedRef.current||phaseRef.current!=='stopping'){
        await discardKnowMeVoice(file.uri).catch(()=>undefined);
        return;
      }
      capturedRef.current=file;setRecorded(file);setPositionMs(0);setCanSeek(false);next('preview');
      // Check native capabilities without assuming that older APKs expose seeking.
      void getKnowMeVoicePlaybackStatus().then(status=>{
        if(mountedRef.current&&status&&capturedRef.current?.uri===file.uri)setCanSeek(true);
      }).catch(()=>undefined);
    }catch(error){
      await cancelKnowMeVoice().catch(()=>undefined);
      if(mountedRef.current){next('idle');setOpen(false);showError(error);}
    }
  }
  async function cancel(){
    if(!voiceUiState(phaseRef.current,busy).canCancel)return;
    const wasRecording=phaseRef.current==='recording'||phaseRef.current==='starting';
    next('idle');setOpen(false);setSeconds(0);setRecorded(null);setPreviewPlaying(false);
    setPositionMs(0);setCanSeek(false);
    const file=capturedRef.current;
    // Cleanup steps must be independent: a playback failure may not skip discarding a file.
    if(wasRecording)await cancelKnowMeVoice().catch(()=>undefined);
    await stopKnowMeVoicePlayback().catch(()=>undefined);
    if(file)await discardKnowMeVoice(file.uri).catch(()=>undefined);
    capturedRef.current=null;
  }
  async function send(){
    const file=capturedRef.current;
    if(!voiceUiState(phaseRef.current,busy).canSend||!file)return;
    next('sending');setPreviewPlaying(false);
    try{
      await stopKnowMeVoicePlayback();
      const sent=await onSend(file);
      if(sent||!mountedRef.current){
        await discardKnowMeVoice(file.uri).catch(()=>undefined);
        capturedRef.current=null;
        if(mountedRef.current){
          setRecorded(null);setPositionMs(0);setCanSeek(false);setOpen(false);next('idle');
        }
      }else next('preview');
    }catch(error){
      if(!mountedRef.current){
        await discardKnowMeVoice(file.uri).catch(()=>undefined);
        capturedRef.current=null;
      }else {next('preview');showError(error);}
    }
  }
  useEffect(()=>{
    // A backgrounded app must not keep an unattended open microphone.
    const listener=AppState.addEventListener('change',status=>{
      if(status!=='active'){
        // The Android microphone permission prompt can briefly make the app inactive.
        // Do not cancel the pending permission dialog; abort only on real background.
        if(phaseRef.current==='recording'||
          (phaseRef.current==='starting'&&status==='background'))void cancel();
        if(phaseRef.current==='preview'){
          void stopKnowMeVoicePlayback().catch(()=>undefined);
          setPreviewPlaying(false);
        }
      }
    });
    return ()=>listener.remove();
  },[]);
  async function togglePreview(){
    const file=capturedRef.current;
    if(phaseRef.current!=='preview'||!file||playbackBusy)return;
    setPlaybackBusy(true);
    try {
      if(previewPlaying){await stopKnowMeVoicePlayback();setPreviewPlaying(false);}
      else {
        setPositionMs(0);await playKnowMeVoice(file.uri);
        if(!mountedRef.current||phaseRef.current!=='preview'){
          await stopKnowMeVoicePlayback().catch(()=>undefined);
          return;
        }
        setPreviewPlaying(true);
      }
    }catch(error){setPreviewPlaying(false);showError(error);}
    finally{if(mountedRef.current)setPlaybackBusy(false);}
  }
  async function seekPreview(tapX:number){
    if(!canSeek||phaseRef.current!=='preview'||!recorded)return;
    const nextPosition=voiceSeekMs(tapX,seekWidth.current,recorded.durationMs);
    try{
      await seekKnowMeVoicePlayback(nextPosition);
      if(mountedRef.current&&phaseRef.current==='preview')setPositionMs(nextPosition);
    }catch(error){showError(error);}
  }
  const time=voiceClock(phase==='preview'&&recorded?recorded.durationMs:seconds*1000);
  return <>
    <PressScale accessibilityRole="button" accessibilityLabel={copy.record}
      disabled={!actions.canStart} onPress={()=>void begin()}
      style={[styles.microphone,referenceChat?styles.referenceMicrophone:{backgroundColor:colors.backgroundAccent}]}>
      <KnowMeIcon name="microphone" size={referenceChat?26:23} color={referenceChat?'#0b141a':colors.accent}/>
    </PressScale>
    <Modal visible={open} transparent animationType="fade" onRequestClose={()=>{void cancel();}}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet,{backgroundColor:referenceChat?'#202c33':colors.surface,borderColor:referenceChat?'#35444b':colors.border}]}>
          <View style={styles.header}>
            <Text style={[styles.heading,{color:referenceChat?'#e9edef':colors.text}]}>{copy.heading}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={copy.cancel}
              disabled={!actions.canCancel} onPress={()=>{void cancel();}}
              style={styles.close}>
              <KnowMeIcon name="close" color={colors.danger} size={23}/>
            </Pressable>
          </View>
          <Text style={[styles.time,{color:referenceChat?'#53bdeb':colors.accent}]} accessibilityLiveRegion="polite">
            {phase==='recording'?'● ':''}{time}
          </Text>
          <Text style={[styles.hint,{color:referenceChat?'#aebac1':colors.muted}]}>
            {phase==='recording'?copy.recording
             :phase==='preview'?copy.preview
             :phase==='sending'?copy.sending:copy.starting}
          </Text>
          {phase==='starting'||phase==='stopping'||phase==='sending' ? <ActivityIndicator color={colors.accent}/> : null}
          {phase==='recording'&&
            <PressScale accessibilityRole="button" onPress={()=>void finish()}
              style={[styles.primary,{backgroundColor:colors.accent}]}>
              <Text style={{color:colors.accentText,fontWeight:'700'}}>{copy.finish}</Text>
            </PressScale>}
          {phase==='preview'&&recorded&&<>
            <Text style={{color:colors.muted,fontSize:12}}>
              {Math.ceil(recorded.durationMs/1000)} s · {Math.ceil((recorded.size??0)/1024)} Ko
            </Text>
            {canSeek&&<View style={styles.seekRow}>
              <Pressable accessibilityRole="adjustable" accessibilityLabel={copy.seek}
                disabled={!previewPlaying||playbackBusy}
                accessibilityActions={[{name:'increment'},{name:'decrement'}]}
                onAccessibilityAction={event=>{
                  const delta=event.nativeEvent.actionName==='increment'?0.1:-0.1;
                  const next=voiceProgress(positionMs,recorded.durationMs)+delta;
                  void seekPreview(seekWidth.current*next);
                }}
                accessibilityValue={{min:0,max:100,now:Math.round(voiceProgress(positionMs,recorded.durationMs)*100)}}
                onLayout={event=>{seekWidth.current=event.nativeEvent.layout.width;}}
                onPress={event=>void seekPreview(event.nativeEvent.locationX)}
                style={styles.seekTouch}>
                <View style={[styles.seekTrack,{backgroundColor:colors.backgroundAccent}]}>
                  <View style={[styles.seekFill,{width:`${voiceProgress(positionMs,recorded.durationMs)*100}%` as `${number}%`,
                    backgroundColor:colors.accent}]}/>
                </View>
              </Pressable>
              <Text style={[styles.seekTime,{color:colors.muted}]}>{voiceClock(positionMs)} / {voiceClock(recorded.durationMs)}</Text>
            </View>}
            <View style={styles.previewActions}>
              <PressScale accessibilityRole="button" accessibilityLabel={previewPlaying?copy.stop:copy.listen}
                disabled={playbackBusy} onPress={()=>void togglePreview()}
                style={[styles.secondary,{backgroundColor:colors.backgroundAccent}]}>
                {playbackBusy?<ActivityIndicator color={colors.accent}/>:
                  <KnowMeIcon name={previewPlaying?'pause':'play'} size={22} color={colors.accent}/>}
                <Text style={{color:colors.text,fontWeight:'700'}}>{previewPlaying?copy.stop:copy.listen}</Text>
              </PressScale>
              <PressScale accessibilityRole="button" accessibilityLabel={copy.send}
                disabled={!actions.canSend} onPress={()=>void send()}
                style={[styles.sendVoice,{backgroundColor:colors.accent}]}>
                <KnowMeIcon name="arrow" size={20} color={colors.accentText}/>
                <Text style={{color:colors.accentText,fontWeight:'700',fontSize:16}}>{copy.send}</Text>
              </PressScale>
            </View>
          </>}
          {phase==='preview'&&<Pressable accessibilityRole="button" accessibilityLabel={copy.discard}
            onPress={()=>void cancel()} style={[styles.cancel,{borderColor:colors.danger}]}>
            <KnowMeIcon name="close" size={18} color={colors.danger}/>
            <Text style={{color:colors.danger,fontWeight:'700'}}>{copy.discard}</Text>
          </Pressable>}
          {phase==='recording'&&<Text style={[styles.maxHint,{color:colors.muted}]}>{copy.max}</Text>}
          {phase==='recording'&&<Pressable accessibilityRole="button" accessibilityLabel={copy.cancel} onPress={()=>void cancel()}
            style={[styles.cancel,{borderColor:colors.danger}]}>
            <KnowMeIcon name="close" color={colors.danger} size={18}/>
            <Text style={{color:colors.danger,fontWeight:'700'}}>{copy.cancel}</Text>
          </Pressable>}
        </View>
      </View>
    </Modal>
  </>;
}
const styles=StyleSheet.create({
  microphone:{minHeight:44,minWidth:44,paddingHorizontal:5,borderRadius:22,
    alignItems:'center',justifyContent:'center'},
  referenceMicrophone:{width:52,height:52,borderRadius:26,backgroundColor:'#f5f6f6',marginLeft:0},
  backdrop:{flex:1,backgroundColor:'rgba(0,0,0,.5)',justifyContent:'flex-end'},
  sheet:{borderTopLeftRadius:26,borderTopRightRadius:26,borderWidth:StyleSheet.hairlineWidth,
    padding:20,paddingBottom:36,gap:13},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  heading:{fontSize:20,fontWeight:'800'},
  close:{width:44,height:44,alignItems:'center',justifyContent:'center'},
  time:{fontSize:31,fontWeight:'800',textAlign:'center',fontVariant:['tabular-nums']},
  hint:{fontSize:13,lineHeight:20,textAlign:'center'},
  maxHint:{fontSize:11,textAlign:'center'},
  seekRow:{gap:1},
  seekTouch:{height:44,justifyContent:'center'},
  seekTrack:{height:6,borderRadius:6,overflow:'hidden'},
  seekFill:{height:6,borderRadius:6},
  seekTime:{fontSize:11,textAlign:'right',fontVariant:['tabular-nums']},
  actions:{flexDirection:'row',gap:10},
  previewActions:{gap:13,marginTop:10},
  sendVoice:{height:58,width:'100%',borderRadius:18,flexDirection:'row',
    gap:11,alignItems:'center',justifyContent:'center'},
  primary:{minHeight:48,flex:1,alignItems:'center',justifyContent:'center',borderRadius:19,paddingHorizontal:18},
  secondary:{minHeight:48,alignItems:'center',justifyContent:'center',borderRadius:19,paddingHorizontal:18,flexDirection:'row',gap:8},
  cancel:{minHeight:51,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8,borderWidth:1,borderRadius:16,marginTop:9}
});
