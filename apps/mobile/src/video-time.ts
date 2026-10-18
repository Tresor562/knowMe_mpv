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
