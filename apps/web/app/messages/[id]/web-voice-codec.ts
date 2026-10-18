/** Offline PCM -> mono 16-bit WAV for browsers without Ogg/Opus encoding.
 * KnowMe's media scanner already validates RIFF/WAVE and accepts audio/wav.
 * The file is never uploaded unless the user confirms Send in the composer.
 */
export function encodeKnowMeVoiceWav(chunks:Float32Array[],sampleRate:number,maxSeconds=55):Uint8Array{
  if(!Number.isFinite(sampleRate)||sampleRate<8000||sampleRate>192000)
    throw new Error('Fréquence audio invalide.');
  const rate=16000;
  const limit=Math.floor(sampleRate*maxSeconds);
  const samples=chunks.reduce((count,chunk)=>count+chunk.length,0);
  if(samples<=0)throw new Error('Aucune donnée audio.');
  const length=Math.min(samples,limit);
  const input=new Float32Array(length);
  let cursor=0;
  for(const chunk of chunks){
    const copy=Math.min(chunk.length,length-cursor);
    if(copy<=0)break;
    input.set(chunk.subarray(0,copy),cursor);
    cursor+=copy;
  }
  const count=Math.floor(length*rate/sampleRate);
  if(count<rate/2)throw new Error('Message trop court.');
  const wav=new Uint8Array(44+count*2);
  const view=new DataView(wav.buffer);
  function label(offset:number,text:string){
    for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));
  }
  label(0,'RIFF');view.setUint32(4,36+count*2,true);
  label(8,'WAVE');label(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);
  view.setUint16(32,2,true);view.setUint16(34,16,true);
  label(36,'data');view.setUint32(40,count*2,true);
  for(let i=0;i<count;i++){
    const source=i*sampleRate/rate;
    const a=Math.floor(source),b=Math.min(length-1,a+1);
    const t=source-a;
    const raw=input[a]*(1-t)+input[b]*t;
    const v=Math.max(-1,Math.min(1,raw));
    view.setInt16(44+i*2,v<0?v*32768:v*32767,true);
  }
  return wav;
}
