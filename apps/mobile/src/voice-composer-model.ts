/** Pure rules for the native voice composer. Keep send and discard distinct. */
export type VoicePhase='idle'|'starting'|'recording'|'stopping'|'preview'|'sending';

export function voiceUiState(phase:VoicePhase,busy:boolean){
  return {
    canStart:phase==='idle'&&!busy,
    canFinish:phase==='recording',
    canCancel:phase!=='stopping'&&phase!=='sending',
    canPreview:phase==='preview',
    canSend:phase==='preview'&&!busy
  };
}

/** 00:00, even before the first recorder tick; never show NaN/negative time. */
export function voiceClock(durationMs:number):string {
  const seconds=Number.isFinite(durationMs)?Math.max(0,Math.floor(durationMs/1000)):0;
  return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;
}
