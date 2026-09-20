import {createHash,randomUUID} from 'node:crypto';
import {collectHeroAndroidProfile,HeroAndroidCollectorInput,HeroAndroidMemorySample,HeroAndroidDeviceIdentity,HeroAndroidBuildIdentity} from './hero-runtime-android-collector-v19.domain';
import {HeroAndroidLodTelemetryProfile,HeroLodMeasuredTransition} from './hero-runtime-lod-telemetry-v18.domain';

export const HERO_ANDROID_SESSION_SCHEMA='knowme.hero.android.session.v20' as const;
export type HeroAndroidSessionIdentity={schema:typeof HERO_ANDROID_SESSION_SCHEMA;sessionId:string;startedAtMs:number;device:HeroAndroidDeviceIdentity;build:HeroAndroidBuildIdentity};
export type HeroAndroidSessionResult={identity:HeroAndroidSessionIdentity;profile:HeroAndroidLodTelemetryProfile;evidenceSha256:string;endedAtMs:number};

type Clock=()=>number;
type IdFactory=()=>string;
const finiteNonNegative=(name:string,value:number)=>{if(!Number.isFinite(value)||value<0)throw new Error(`Android session ${name} is invalid.`);};
const canonical=(value:unknown):string=>{if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;const object=value as Record<string,unknown>;return `{${Object.keys(object).sort().map(key=>`${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;};
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value));

export class HeroAndroidMeasuredSession{
 private readonly identity:HeroAndroidSessionIdentity;
 private readonly frameTimesMs:number[]=[];
 private readonly memorySamples:HeroAndroidMemorySample[]=[];
 private readonly lodTransitions:HeroLodMeasuredTransition[]=[];
 private sealed=false;
 constructor(device:HeroAndroidDeviceIdentity,build:HeroAndroidBuildIdentity,private readonly clock:Clock=Date.now,ids:IdFactory=randomUUID){
  const startedAtMs=clock();finiteNonNegative('start time',startedAtMs);
  this.identity={schema:HERO_ANDROID_SESSION_SCHEMA,sessionId:ids(),startedAtMs,device:clone(device),build:clone(build)};
  if(!this.identity.sessionId.trim())throw new Error('Android session id is required.');
 }
 private writable(){if(this.sealed)throw new Error('Android session is already sealed.');}
 recordFrame(frameTimeMs:number){this.writable();finiteNonNegative('frame time',frameTimeMs);this.frameTimesMs.push(frameTimeMs);}
 recordMemory(sample:HeroAndroidMemorySample){this.writable();finiteNonNegative('java memory',sample.javaBytes);finiteNonNegative('native memory',sample.nativeBytes);finiteNonNegative('gpu memory',sample.gpuBytes);this.memorySamples.push({...sample});}
 recordLodTransition(transition:HeroLodMeasuredTransition){this.writable();this.lodTransitions.push({...transition});}
 finish(coldLoadMs:number,warmLoadMs:number):HeroAndroidSessionResult{
  this.writable();const endedAtMs=this.clock();finiteNonNegative('end time',endedAtMs);if(endedAtMs<this.identity.startedAtMs)throw new Error('Android session end precedes start.');
  const input:HeroAndroidCollectorInput={device:clone(this.identity.device),build:clone(this.identity.build),coldLoadMs,warmLoadMs,frameTimesMs:[...this.frameTimesMs],memorySamples:this.memorySamples.map(sample=>({...sample})),lodTransitions:this.lodTransitions.map(transition=>({...transition}))};
  const profile=collectHeroAndroidProfile(input);const evidence={identity:this.identity,endedAtMs,raw:{coldLoadMs,warmLoadMs,frameTimesMs:input.frameTimesMs,memorySamples:input.memorySamples,lodTransitions:input.lodTransitions}};
  const evidenceSha256=createHash('sha256').update(canonical(evidence)).digest('hex');this.sealed=true;
  return {identity:clone(this.identity),profile:clone(profile),evidenceSha256,endedAtMs};
 }
 snapshot(){return {identity:clone(this.identity),frames:this.frameTimesMs.length,memorySamples:this.memorySamples.length,lodTransitions:this.lodTransitions.length,sealed:this.sealed};}
}
