import {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, AppState, Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import type {RecordedKnowMeVoice} from './native-voice';
import {cancelKnowMeVoice,discardKnowMeVoice,getKnowMeVoicePlaybackStatus,playKnowMeVoice,
  startKnowMeVoice,stopKnowMeVoice,stopKnowMeVoicePlayback} from './native-voice';
import {voiceClock,voiceUiState,type VoicePhase} from './voice-composer-model';
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
    max:'Maximum recording length: 56 seconds.'
  }: {
    record:'Enregistrer un message vocal',heading:'Message vocal',cancel:'Supprimer ce vocal',
    unavailable:'Note vocale indisponible',missingMic:'Le microphone est temporairement indisponible.',
    recording:'Enregistrement… Termine pour vérifier avant tout envoi.',
    preview:'Prêt à envoyer. Écoute ou supprime : aucun envoi automatique.',
    sending:'Envoi sécurisé…',starting:'Préparation du microphone…',finish:'Terminer l’enregistrement',
    listen:'Écouter',stop:'Arrêter la lecture',send:'Envoyer le vocal',discard:'Supprimer l’enregistrement',
    max:'Durée maximale de l’enregistrement : 56 secondes.'
  };
  const [phase,setPhase]=useState<Phase>('idle');
  const [seconds,setSeconds]=useState(0);
  const [recorded,setRecorded]=useState<RecordedKnowMeVoice|null>(null);
  const [open,setOpen]=useState(false);
  const [previewPlaying,setPreviewPlaying]=useState(false);
  const [playbackBusy,setPlaybackBusy]=useState(false);
  const phaseRef=useRef<Phase>('idle');
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
        if(status&&phaseRef.current==='preview'&&!status.playing)setPreviewPlaying(false);
      }).catch(()=>setPreviewPlaying(false));
    },700);
    return ()=>clearInterval(interval);
  },[phase,previewPlaying]);

  useEffect(()=>()=>{
    if(phaseRef.current==='recording'||phaseRef.current==='starting'||phaseRef.current==='stopping'){
      void cancelKnowMeVoice().catch(()=>undefined);
    }
    const file=capturedRef.current;
    if(file)void discardKnowMeVoice(file.uri).catch(()=>undefined);
    void stopKnowMeVoicePlayback().catch(()=>undefined);
  },[]);

  function showError(error:unknown){
    Alert.alert(copy.unavailable,
      error instanceof Error?error.message:copy.missingMic);
  }

  async function begin(){
    if(!voiceUiState(phaseRef.current,busy).canStart)return;
    setOpen(true);setSeconds(0);next('starting');
    try{
      await startKnowMeVoice();
      // The permission request is asynchronous: a close can change the phase.
      if ((phaseRef.current as Phase)!=='starting') {
        await cancelKnowMeVoice();
        return;
      }
      startedAt.current=Date.now();
      next('recording');
    }catch(e){
      next('idle');setOpen(false);showError(e);
    }
  }
  async function finish(){
    if(!voiceUiState(phaseRef.current,busy).canFinish)return;
    next('stopping');
    try {
      const file=await stopKnowMeVoice();
      capturedRef.current=file;setRecorded(file);next('preview');
    }catch(error){next('idle');setOpen(false);showError(error);}
  }
  async function cancel(){
    if(!voiceUiState(phaseRef.current,busy).canCancel)return;
    const wasRecording=phaseRef.current==='recording'||phaseRef.current==='starting';
    next('idle');setOpen(false);setSeconds(0);setRecorded(null);setPreviewPlaying(false);
    try {
      if(wasRecording)await cancelKnowMeVoice();
      await stopKnowMeVoicePlayback();
      if(capturedRef.current)await discardKnowMeVoice(capturedRef.current.uri);
    }catch{ /* cleanup best effort; never leave an open microphone */ }
    capturedRef.current=null;
  }
  async function send(){
    const file=capturedRef.current;
    if(!voiceUiState(phaseRef.current,busy).canSend||!file)return;
    next('sending');setPreviewPlaying(false);
    try{
      await stopKnowMeVoicePlayback();
      const sent=await onSend(file);
      if(sent){
        await discardKnowMeVoice(file.uri).catch(()=>undefined);
        capturedRef.current=null;setRecorded(null);setOpen(false);next('idle');
      }else next('preview');
    }catch(error){next('preview');showError(error);}
  }
  useEffect(()=>{
    // A backgrounded app must not keep an unattended open microphone.
    const listener=AppState.addEventListener('change',status=>{
      if(status!=='active'&&(phaseRef.current==='recording'||phaseRef.current==='starting')) {
        void cancel();
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
      else {await playKnowMeVoice(file.uri);setPreviewPlaying(true);}
    }catch(error){setPreviewPlaying(false);showError(error);}
    finally{setPlaybackBusy(false);}
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
  actions:{flexDirection:'row',gap:10},
  previewActions:{gap:13,marginTop:10},
  sendVoice:{height:58,width:'100%',borderRadius:18,flexDirection:'row',
    gap:11,alignItems:'center',justifyContent:'center'},
  primary:{minHeight:48,flex:1,alignItems:'center',justifyContent:'center',borderRadius:19,paddingHorizontal:18},
  secondary:{minHeight:48,alignItems:'center',justifyContent:'center',borderRadius:19,paddingHorizontal:18,flexDirection:'row',gap:8},
  cancel:{minHeight:51,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8,borderWidth:1,borderRadius:16,marginTop:9}
});
