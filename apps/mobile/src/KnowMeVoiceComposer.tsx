import {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, AppState, Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import type {RecordedKnowMeVoice} from './native-voice';
import {cancelKnowMeVoice,discardKnowMeVoice,playKnowMeVoice,
  startKnowMeVoice,stopKnowMeVoice,stopKnowMeVoicePlayback} from './native-voice';
import {KnowMeAlert as Alert} from './ui/KnowMeFeedback';
import {useAppearance} from './AppearanceProvider';
import {KnowMeIcon, PressScale} from './ui/KnowMeUI';

type Phase='idle'|'starting'|'recording'|'stopping'|'preview'|'sending';
const MAX_SECONDS=56; // stop before the native 60-second media-recorder safety limit

export function KnowMeVoiceComposer({busy,onSend,referenceChat=false}:{
  busy:boolean;
  onSend:(file:RecordedKnowMeVoice)=>Promise<boolean>;
  referenceChat?:boolean;
}) {
  const {colors}=useAppearance();
  const [phase,setPhase]=useState<Phase>('idle');
  const [seconds,setSeconds]=useState(0);
  const [recorded,setRecorded]=useState<RecordedKnowMeVoice|null>(null);
  const [open,setOpen]=useState(false);
  const phaseRef=useRef<Phase>('idle');
  const capturedRef=useRef<RecordedKnowMeVoice|null>(null);
  const startedAt=useRef(0);
  function next(value:Phase){phaseRef.current=value;setPhase(value);}
  useEffect(()=>{
    if(phase!=='recording')return;
    const interval=setInterval(()=>{
      const elapsed=Math.floor((Date.now()-startedAt.current)/1000);
      setSeconds(elapsed);
      if(elapsed>=MAX_SECONDS)void finish();
    },250);
    return ()=>clearInterval(interval);
  },[phase]);

  useEffect(()=>()=>{
    if(phaseRef.current==='recording'||phaseRef.current==='starting'||phaseRef.current==='stopping'){
      void cancelKnowMeVoice().catch(()=>undefined);
    }
    const file=capturedRef.current;
    if(file)void discardKnowMeVoice(file.uri).catch(()=>undefined);
    void stopKnowMeVoicePlayback().catch(()=>undefined);
  },[]);

  function showError(error:unknown){
    Alert.alert('Note vocale indisponible',
      error instanceof Error?error.message:'Le microphone est temporairement indisponible.');
  }

  async function begin(){
    if(phaseRef.current!=='idle'||busy)return;
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
    if(phaseRef.current!=='recording')return;
    next('stopping');
    try {
      const file=await stopKnowMeVoice();
      capturedRef.current=file;setRecorded(file);next('preview');
    }catch(error){next('idle');setOpen(false);showError(error);}
  }
  async function cancel(){
    if(phaseRef.current==='sending'||phaseRef.current==='stopping')return;
    const wasRecording=phaseRef.current==='recording'||phaseRef.current==='starting';
    next('idle');setOpen(false);setSeconds(0);setRecorded(null);
    try {
      if(wasRecording)await cancelKnowMeVoice();
      await stopKnowMeVoicePlayback();
      if(capturedRef.current)await discardKnowMeVoice(capturedRef.current.uri);
    }catch{ /* cleanup best effort; never leave an open microphone */ }
    capturedRef.current=null;
  }
  async function send(){
    const file=capturedRef.current;
    if(phaseRef.current!=='preview'||!file||busy)return;
    next('sending');
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
      if(status!=='active'&&phaseRef.current==='recording') {
        void cancel();
      }
    });
    return ()=>listener.remove();
  },[]);
  const time=`${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;
  return <>
    <PressScale accessibilityRole="button" accessibilityLabel="Enregistrer un message vocal"
      disabled={busy||phase!=='idle'} onPress={()=>void begin()}
      style={[styles.microphone,referenceChat?styles.referenceMicrophone:{backgroundColor:colors.backgroundAccent}]}>
      <KnowMeIcon name="microphone" size={referenceChat?26:23} color={referenceChat?'#0b141a':colors.accent}/>
    </PressScale>
    <Modal visible={open} transparent animationType="fade" onRequestClose={()=>{void cancel();}}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet,{backgroundColor:referenceChat?'#202c33':colors.surface,borderColor:referenceChat?'#35444b':colors.border}]}>
          <View style={styles.header}>
            <Text style={[styles.heading,{color:referenceChat?'#e9edef':colors.text}]}>Note vocale</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Annuler le vocal"
              disabled={phase==='sending'||phase==='stopping'} onPress={()=>{void cancel();}}
              style={styles.close}>
              <KnowMeIcon name="close" color={colors.text} size={23}/>
            </Pressable>
          </View>
          <Text style={[styles.time,{color:referenceChat?'#53bdeb':colors.accent}]} accessibilityLiveRegion="polite">
            {phase==='recording'?'● ':''}{time}
          </Text>
          <Text style={[styles.hint,{color:referenceChat?'#aebac1':colors.muted}]}>
            {phase==='recording'?'Enregistrement en cours… Appuie sur Terminer pour le vérifier.'
             :phase==='preview'?'Note enregistrée. Tu peux l’écouter, l’envoyer ou l’annuler.'
             :phase==='sending'?'Envoi sécurisé…':'Préparation du microphone…'}
          </Text>
          {phase==='starting'||phase==='stopping'||phase==='sending' ? <ActivityIndicator color={colors.accent}/> : null}
          {phase==='recording'&&
            <PressScale accessibilityRole="button" onPress={()=>void finish()}
              style={[styles.primary,{backgroundColor:colors.accent}]}>
              <Text style={{color:colors.accentText,fontWeight:'800'}}>Terminer</Text>
            </PressScale>}
          {phase==='preview'&&recorded&&<>
            <Text style={{color:colors.muted,fontSize:12}}>
              ${Math.ceil(recorded.durationMs/1000)} s · ${Math.ceil((recorded.size??0)/1024)} Ko
            </Text>
            <View style={styles.actions}>
              <PressScale accessibilityRole="button" accessibilityLabel="Écouter la note"
                onPress={()=>void playKnowMeVoice(recorded.uri).catch(showError)}
                style={[styles.secondary,{backgroundColor:colors.backgroundAccent}]}>
                <Text style={{color:colors.text,fontWeight:'800'}}>Écouter</Text>
              </PressScale>
              <PressScale accessibilityRole="button" accessibilityLabel="Envoyer la note vocale"
                onPress={()=>void send()} style={[styles.primary,{backgroundColor:colors.accent}]}>
                <Text style={{color:colors.accentText,fontWeight:'800'}}>Envoyer</Text>
              </PressScale>
            </View>
          </>}
          {phase!=='sending'&&<Pressable accessibilityRole="button" onPress={()=>void cancel()}
            style={styles.cancel}><Text style={{color:colors.muted,fontWeight:'700'}}>Annuler</Text></Pressable>}
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
  actions:{flexDirection:'row',gap:10},
  primary:{minHeight:48,flex:1,alignItems:'center',justifyContent:'center',borderRadius:19,paddingHorizontal:18},
  secondary:{minHeight:48,flex:1,alignItems:'center',justifyContent:'center',borderRadius:19,paddingHorizontal:18},
  cancel:{minHeight:44,alignItems:'center',justifyContent:'center'}
});
