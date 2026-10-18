/** Formatting accepts playback times longer than an hour without wrapping. */
export function videoTime(milliseconds:number):string{
  const seconds=Number.isFinite(milliseconds)?Math.max(0,Math.floor(milliseconds/1000)):0;
  const hours=Math.floor(seconds/3600);
  const minutes=Math.floor((seconds%3600)/60);
  const rest=seconds%60;
  return hours>0
    ? hours+':'+String(minutes).padStart(2,'0')+':'+String(rest).padStart(2,'0')
    : minutes+':'+String(rest).padStart(2,'0');
}

/**
 * Map a finger offset onto a video's absolute timeline. Numeric bounds are
 * enforced here so videos lasting many hours remain seekable safely.
 */
export function seekTimeFromTrack(durationMs:number,offsetX:number,width:number):number{
  if(!Number.isFinite(durationMs)||durationMs<=0)return 0;
  if(!Number.isFinite(offsetX)||!Number.isFinite(width)||width<=0)return 0;
  return Math.round(Math.min(1,Math.max(0,offsetX/width))*durationMs);
}

/** Relative jumps must never produce negative or out-of-duration timestamps. */
export function clampVideoSeek(positionMs:number,durationMs:number,deltaMs=0):number{
  if(!Number.isFinite(durationMs)||durationMs<=0)return 0;
  const position=Number.isFinite(positionMs)?positionMs:0;
  const delta=Number.isFinite(deltaMs)?deltaMs:0;
  return Math.floor(Math.min(durationMs,Math.max(0,position+delta)));
}
