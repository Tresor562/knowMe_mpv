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
  // Length/format were checked above; explicit fallbacks also satisfy
  // TypeScript's noUncheckedIndexedAccess and prevent NaN propagation.
  const first=numbers[0]??0;
  const second=numbers[1]??0;
  const third=numbers[2]??0;
  if(tokens.length>1&&(tokens.length===2?second:third)>59)return null;
  if(tokens.length===3&&second>59)return null;
  const seconds=tokens.length===3
    ?first*3600+second*60+third
    :tokens.length===2?first*60+second:first;
  if(!Number.isSafeInteger(seconds))return null;
  return Math.min(Math.floor(durationMs),seconds*1000);
}

/** A finished player must rewind instead of toggling a stale pause state. */
export function videoTapIntent(ended:boolean,paused:boolean):'replay'|'play'|'pause'{
  if(ended)return 'replay';
  return paused?'play':'pause';
}

/** Player contract: short clips hide idle progress; long clips keep a thin rail. */
export function reelProgressMode(
  durationMs:number, paused:boolean, visible:boolean, scrubbing:boolean
):'hidden'|'thin'|'expanded'{
  if(paused||visible||scrubbing)return 'expanded';
  return Number.isFinite(durationMs)&&durationMs>=180_000?'thin':'hidden';
}
