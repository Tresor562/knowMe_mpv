'use client';

import {useEffect,useRef,useState,type KeyboardEvent} from 'react';
import {apiFetch} from '../../../lib/api';
import {useI18n} from '../../../components/i18n-provider';
import {encodeKnowMeVoiceWav} from './web-voice-codec';
import styles from './WebVoiceCapture.module.css';

type UploadSession={id:string;uploadToken:string};
type UploadAsset={id:string;status:string;scannerVerdict?:string};
type VoiceEngine={
  stream:MediaStream;
  context:AudioContext;
  input:MediaStreamAudioSourceNode;
  processor:ScriptProcessorNode;
  silent:GainNode;
};
type Phase='idle'|'starting'|'recording'|'stopping'|'ready'|'uploading';
const MAX_SECONDS=50; // Mic frame capture completes before users hit server upload limits.

export function WebVoiceCapture<T>({conversationId,onSent,disabled=false}:{
  conversationId:string;
  onSent:(message:T)=>void;
  disabled?:boolean;
}){
  const {locale}=useI18n(),en=locale==='en';
  const [open,setOpen]=useState(false);
  const [phase,setPhase]=useState<Phase>('idle');
  const [seconds,setSeconds]=useState(0);
  const [ready,setReady]=useState<File|null>(null);
  const [previewUrl,setPreviewUrl]=useState<string|null>(null);
  const [error,setError]=useState('');
  const engine=useRef<VoiceEngine|null>(null);
  const chunks=useRef<Float32Array[]>([]);
  const sampleRate=useRef(48000);
  const started=useRef(0);
  const triggerRef=useRef<HTMLButtonElement>(null);
  const closeRef=useRef<HTMLButtonElement>(null);
  const dialogRef=useRef<HTMLElement>(null);
  const phaseRef=useRef<Phase>('idle');
  const mountedRef=useRef(true);
  function next(value:Phase){phaseRef.current=value;setPhase(value);}
  useEffect(()=>{if(open)closeRef.current?.focus();},[open]);
  useEffect(()=>{
    if(!open)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return ()=>{document.body.style.overflow=previous;};
  },[open]);

  async function stopEngine(){
    const item=engine.current;
    engine.current=null;
    if(!item)return;
    item.processor.onaudioprocess=null;
    item.processor.disconnect();
    item.input.disconnect();
    item.silent.disconnect();
    item.stream.getTracks().forEach(track=>track.stop());
    await item.context.close().catch(()=>undefined);
  }

  useEffect(()=>{
    mountedRef.current=true;
    return ()=>{
      mountedRef.current=false;
      phaseRef.current='idle';
      chunks.current=[];
      // A late microphone permission grant must not start an unmounted recorder.
      void stopEngine();
    };
  },[]);
  useEffect(()=>{
    if(!ready){setPreviewUrl(null);return;}
    const url=URL.createObjectURL(ready);
    setPreviewUrl(url);
    return ()=>URL.revokeObjectURL(url);
  },[ready]);
  useEffect(()=>{
    const visibility=()=>{
      // Never keep a private microphone running after the browser is backgrounded.
      if(document.visibilityState==='hidden'&&
         (phaseRef.current==='starting'||phaseRef.current==='recording'))void cancel();
    };
    document.addEventListener('visibilitychange',visibility);
    return ()=>document.removeEventListener('visibilitychange',visibility);
  },[]);

  useEffect(()=>{
    if(phase!=='recording')return;
    const interval=setInterval(()=>{
      const elapsed=Math.floor((Date.now()-started.current)/1000);
      setSeconds(elapsed);
      if(elapsed>=MAX_SECONDS)void finish();
    },300);
    return ()=>clearInterval(interval);
  },[phase]);

  function handleDialogKeys(event:KeyboardEvent<HTMLElement>){
    if(event.key==='Escape'&&phaseRef.current!=='uploading'){
      event.preventDefault();
      void cancel();
      return;
    }
    if(event.key!=='Tab')return;
    const nodes=dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), audio[controls], [tabindex]:not([tabindex="-1"])');
    if(!nodes?.length)return;
    const first=nodes[0],last=nodes[nodes.length-1];
    if(event.shiftKey&&document.activeElement===first){
      event.preventDefault();last?.focus();
    }else if(!event.shiftKey&&document.activeElement===last){
      event.preventDefault();first?.focus();
    }
  }

  async function begin(){
    if(disabled||phaseRef.current!=='idle')return;
    next('starting');setError('');setSeconds(0);setOpen(true);chunks.current=[];
    let stream:MediaStream|null=null;
    let context:AudioContext|null=null;
    try{
      if(!navigator.mediaDevices?.getUserMedia) {
        throw new Error(en?'Microphone unavailable in this browser.':'Microphone indisponible dans ce navigateur.');
      }
      stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true},video:false});
      if(!mountedRef.current||(phaseRef.current as Phase)!=='starting'){
        stream.getTracks().forEach(track=>track.stop());return;
      }
      context=new AudioContext();
      sampleRate.current=context.sampleRate;
      const input=context.createMediaStreamSource(stream);
      const processor=context.createScriptProcessor(4096,1,1);
      const silent=context.createGain();
      silent.gain.value=0;
      processor.onaudioprocess=event=>{
        if(phaseRef.current!=='recording')return;
        chunks.current.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      input.connect(processor);
      processor.connect(silent);
      silent.connect(context.destination);
      engine.current={stream,context,input,processor,silent};
      await context.resume();
      if(!mountedRef.current||(phaseRef.current as Phase)!=='starting'){
        await stopEngine();return;
      }
      started.current=Date.now();next('recording');
    }catch(cause){
      if(stream&&!engine.current)stream.getTracks().forEach(track=>track.stop());
      if(context&&!engine.current)await context.close().catch(()=>undefined);
      await stopEngine();
      next('idle');setOpen(false);
      setError(cause instanceof Error?cause.message:(en?'Cannot access microphone.':'Accès au micro impossible.'));
    }
  }
  async function finish(){
    if(phaseRef.current!=='recording')return;
    next('stopping');
    await stopEngine();
    // Cancel or conversation-switch during asynchronous audio shutdown must
    // never resurrect a deleted recording.
    if(!mountedRef.current||phaseRef.current!=='stopping'){chunks.current=[];return;}
    try{
      const wav=encodeKnowMeVoiceWav(chunks.current,sampleRate.current,MAX_SECONDS);
      chunks.current=[];
      const file=new File([wav.buffer as ArrayBuffer],`knowme-vocal-${Date.now()}.wav`,{type:'audio/wav'});
      setReady(file);next('ready');
    }catch(cause){
      chunks.current=[];next('idle');setOpen(false);
      setError(cause instanceof Error?cause.message:'Note vocale invalide.');
    }
  }
  async function cancel(){
    if(phaseRef.current==='uploading')return;
    next('idle');setOpen(false);setReady(null);setError('');chunks.current=[];
    await stopEngine();
    triggerRef.current?.focus();
  }
  async function send(){
    if(phaseRef.current!=='ready'||!ready)return;
    next('uploading');setError('');
    try{
      const session=await apiFetch<UploadSession>('/media/uploads',{
        method:'POST',body:JSON.stringify({
          purpose:'MESSAGE',visibility:'CONVERSATION',conversationId,
          maxBytes:ready.size,allowedMime:['audio/wav']
        })
      });
      const data=new FormData();
      data.append('file',ready,ready.name);
      const asset=await apiFetch<UploadAsset>(`/media/uploads/${encodeURIComponent(session.id)}/complete`,{
        method:'POST',headers:{'x-upload-token':session.uploadToken},body:data
      });
      if(asset.status!=='AVAILABLE')
        throw new Error(en?'Audio security scan failed. Nothing was sent.':
          'Le contrôle de sécurité a refusé le vocal. Aucun message envoyé.');
      const message=await apiFetch<T>(`/conversations/${encodeURIComponent(conversationId)}/media-messages`,{
        method:'POST',body:JSON.stringify({assetId:asset.id,kind:'AUDIO'})
      });
      onSent(message);
      setReady(null);setOpen(false);next('idle');triggerRef.current?.focus();
    }catch(cause){
      setError(cause instanceof Error?cause.message:(en?'Voice upload failed.':'Envoi vocal impossible.'));
      next('ready');
    }
  }
  return <>
    <button type="button" className={styles.trigger} ref={triggerRef}
      disabled={disabled||phase!=='idle'}
      aria-label={en?'Record a voice message':'Enregistrer une note vocale'}
      onClick={()=>void begin()}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
        stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="9" y="2" width="6" height="13" rx="3"/>
        <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>
      </svg>
    </button>
    {error&&!open&&<span className={styles.error} role="alert">{error}</span>}
    {open&&<div className={styles.overlay} role="presentation">
      <section ref={dialogRef} className={styles.sheet} role="dialog" aria-modal="true"
        aria-label={en?'Voice message':'Note vocale'} onKeyDown={handleDialogKeys}>
        <div className={styles.header}>
          <strong>{en?'Voice message':'Note vocale'}</strong>
          <button type="button" ref={closeRef} disabled={phase==='uploading'}
            onClick={()=>void cancel()} aria-label={en?'Discard voice recording':'Supprimer l’enregistrement'}>×</button>
        </div>
        <div className={styles.timer} role="status">
          {phase==='recording'?'● ':''}{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}
        </div>
        <p>{phase==='recording'?(en?'Recording… press Done to review.':'Enregistrement… Termine pour écouter.'):
          phase==='starting'?(en?'Opening microphone…':'Ouverture du microphone…'):
          phase==='stopping'?(en?'Preparing preview…':'Préparation de la préécoute…'):
          phase==='uploading'?(en?'Sending voice securely…':'Envoi sécurisé du vocal…'):
          en?'Listen before sending.':'Écoute ton vocal avant de l’envoyer.'}</p>
        {previewUrl&&<audio controls src={previewUrl} preload="metadata"
          aria-label={en?'Preview voice':'Prévisualiser le vocal'}/>}
        {error&&<p className={styles.error} role="alert">{error}</p>}
        <div className={styles.actions}>
          <button type="button" disabled={phase==='uploading'}
            onClick={()=>void cancel()}>{en?'Discard':'Supprimer'}</button>
          {phase==='recording'&&<button type="button" className={styles.primary}
            onClick={()=>void finish()}>{en?'Done':'Terminer'}</button>}
          {phase==='ready'&&<button type="button" className={styles.primary}
            onClick={()=>void send()}>{en?'Send voice':'Envoyer le vocal'}</button>}
        </div>
      </section>
    </div>}
  </>;
}
