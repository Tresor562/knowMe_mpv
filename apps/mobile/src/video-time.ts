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

/** Parse h:mm:ss, mm:ss or bare seconds; invalid clocks cannot seek. */
export function parseVideoTimestamp(value:string,durationMs:number):number|null{
  if(!Number.isFinite(durationMs)||durationMs<=0)return null;
  const tokens=value.trim().split(':');
  if(tokens.length<1||tokens.length>3||tokens.some(token=>!/^\d{1,6}$/.test(token)))return null;
  const numbers=tokens.map(Number);
  if(tokens.length>1&&numbers.at(-1)!>59)return null;
  if(tokens.length===3&&numbers[1]>59)return null;
  const seconds=tokens.length===3
    ?numbers[0]*3600+numbers[1]*60+numbers[2]
    :tokens.length===2?numbers[0]*60+numbers[1]:numbers[0];
  if(!Number.isSafeInteger(seconds))return null;
  return Math.min(Math.floor(durationMs),seconds*1000);
}
