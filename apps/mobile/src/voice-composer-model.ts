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

/** Calculate a stable progress ratio even with malformed native data. */
export function voiceProgress(positionMs:number,durationMs:number):number {
  if(!Number.isFinite(positionMs)||!Number.isFinite(durationMs)||durationMs<=0)return 0;
  return Math.max(0,Math.min(1,positionMs/durationMs));
}

/** Convert a tap position on the native seek track to a bounded media offset. */
export function voiceSeekMs(tapX:number,trackWidth:number,durationMs:number):number {
  if(!Number.isFinite(tapX)||!Number.isFinite(trackWidth)||trackWidth<=0||
     !Number.isFinite(durationMs)||durationMs<=0)return 0;
  return Math.round(Math.max(0,Math.min(1,tapX/trackWidth))*durationMs);
}

/** A pending native recorder may resume after leaving a screen; always revoke it. */
export function shouldCancelNativeCaptureOnUnmount(phase:VoicePhase):boolean {
  return phase==='starting'||phase==='recording'||phase==='stopping';
}

/** A confirmed send owns its file until the upload promise resolves. */
export function shouldDiscardVoiceOnUnmount(phase:VoicePhase):boolean {
  return phase!=='sending';
}
