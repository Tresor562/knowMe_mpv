import {createHash,randomBytes} from 'node:crypto';
import {HeroAndroidBuildIdentity,HeroAndroidDeviceIdentity,HeroAndroidMemorySample} from './hero-runtime-android-collector-v19.domain';
import {HeroLodMeasuredTransition} from './hero-runtime-lod-telemetry-v18.domain';
import {HeroAndroidMeasuredSession,HeroAndroidSessionResult} from './hero-runtime-android-session-v20.domain';

export const HERO_ANDROID_SOURCE_SCHEMA='knowme.hero.android.source.v21' as const;
export type HeroAndroidSourceToken={schema:typeof HERO_ANDROID_SOURCE_SCHEMA;sessionId:string;nonce:string};
export type HeroAndroidSourceReceipt={sequence:number;kind:'frame'|'memory'|'lod';atMs:number};
export type HeroAndroidSourceResult=HeroAndroidSessionResult&{sourceEvidenceSha256:string;sourceReceipts:readonly HeroAndroidSourceReceipt[]};

type Clock=()=>number;
type TokenFactory=()=>string;
const canonical=(value:unknown):string=>{if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;const object=value as Record<string,unknown>;return `{${Object.keys(object).sort().map(key=>`${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;};
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value));

export class HeroAndroidRuntimeSource{
 private readonly session:HeroAndroidMeasuredSession;
 private readonly token:HeroAndroidSourceToken;
 private readonly receipts:HeroAndroidSourceReceipt[]=[];
 private nextSequence=0;
 private finished=false;
 constructor(device:HeroAndroidDeviceIdentity,build:HeroAndroidBuildIdentity,private readonly clock:Clock=Date.now,tokenFactory:TokenFactory=()=>randomBytes(32).toString('hex')){
  this.session=new HeroAndroidMeasuredSession(device,build,clock);
  const identity=this.session.snapshot().identity;
  const nonce=tokenFactory();
  if(!/^[a-f0-9]{64}$/i.test(nonce))throw new Error('Android source token must contain 256 bits encoded as hex.');
  this.token={schema:HERO_ANDROID_SOURCE_SCHEMA,sessionId:identity.sessionId,nonce:nonce.toLowerCase()};
 }
 issueToken():HeroAndroidSourceToken{return clone(this.token);}
 private accept(token:HeroAndroidSourceToken,sequence:number,kind:HeroAndroidSourceReceipt['kind']){
  if(this.finished)throw new Error('Android source is already finished.');
  if(token?.schema!==HERO_ANDROID_SOURCE_SCHEMA||token.sessionId!==this.token.sessionId||token.nonce!==this.token.nonce)throw new Error('Android source token does not belong to this measured session.');
  if(!Number.isSafeInteger(sequence)||sequence!==this.nextSequence)throw new Error(`Android source callback sequence must be ${this.nextSequence}.`);
  const atMs=this.clock();if(!Number.isFinite(atMs)||atMs<0)throw new Error('Android source callback timestamp is invalid.');
  this.receipts.push({sequence,kind,atMs});this.nextSequence++;return atMs;
 }
 recordFrame(token:HeroAndroidSourceToken,sequence:number,frameTimeMs:number){this.accept(token,sequence,'frame');this.session.recordFrame(frameTimeMs);}
 recordMemory(token:HeroAndroidSourceToken,sequence:number,sample:HeroAndroidMemorySample){this.accept(token,sequence,'memory');this.session.recordMemory(sample);}
 recordLodTransition(token:HeroAndroidSourceToken,sequence:number,transition:HeroLodMeasuredTransition){this.accept(token,sequence,'lod');this.session.recordLodTransition(transition);}
 finish(coldLoadMs:number,warmLoadMs:number):HeroAndroidSourceResult{
  if(this.finished)throw new Error('Android source is already finished.');
  const result=this.session.finish(coldLoadMs,warmLoadMs);this.finished=true;
  const sourceReceipts=this.receipts.map(receipt=>({...receipt}));
  const sourceEvidenceSha256=createHash('sha256').update(canonical({schema:HERO_ANDROID_SOURCE_SCHEMA,sessionEvidenceSha256:result.evidenceSha256,token:this.token,receipts:sourceReceipts})).digest('hex');
  return {...result,sourceEvidenceSha256,sourceReceipts};
 }
 snapshot(){return {session:this.session.snapshot(),callbacks:this.receipts.length,nextSequence:this.nextSequence,finished:this.finished};}
}
