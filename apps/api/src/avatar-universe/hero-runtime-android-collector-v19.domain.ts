import {HERO_ANDROID_PROFILE_SCHEMA,HeroAndroidMeasuredProfile} from './hero-runtime-android-profile-v16.domain';
import {HeroAndroidLodTelemetryProfile,HeroLodMeasuredTransition,HeroLodTransitionReason,verifyHeroAndroidLodTelemetry} from './hero-runtime-lod-telemetry-v18.domain';
import {HeroLod} from './hero-runtime-lod-policy-v17.domain';

export const HERO_ANDROID_COLLECTOR_VERSION=19 as const;
export type HeroAndroidDeviceIdentity={manufacturer:string;model:string;androidApi:number;gpu:string;renderer:string};
export type HeroAndroidBuildIdentity={appVersion:string;commitSha:string;runtimeBundleSha256:string};
export type HeroAndroidMemorySample={javaBytes:number;nativeBytes:number;gpuBytes:number};
export type HeroAndroidCollectorInput={device:HeroAndroidDeviceIdentity;build:HeroAndroidBuildIdentity;coldLoadMs:number;warmLoadMs:number;frameTimesMs:readonly number[];memorySamples:readonly HeroAndroidMemorySample[];lodTransitions:readonly HeroLodMeasuredTransition[]};

const finiteNonNegative=(name:string,v:number)=>{if(!Number.isFinite(v)||v<0)throw new Error(`Android collector ${name} is invalid.`);};
const percentile=(sorted:readonly number[],p:number)=>sorted[Math.max(0,Math.ceil(sorted.length*p)-1)];
export function collectHeroAndroidProfile(input:HeroAndroidCollectorInput):HeroAndroidLodTelemetryProfile{
 finiteNonNegative('cold load',input.coldLoadMs);finiteNonNegative('warm load',input.warmLoadMs);
 if(!Array.isArray(input.frameTimesMs)||input.frameTimesMs.length===0)throw new Error('Android collector requires frame samples.');
 const frames=input.frameTimesMs.map((v,i)=>{finiteNonNegative(`frame ${i}`,v);return v;}).sort((a,b)=>a-b);
 if(!Array.isArray(input.memorySamples)||input.memorySamples.length===0)throw new Error('Android collector requires memory samples.');
 let peakJavaBytes=0,peakNativeBytes=0,peakGpuBytes=0;
 for(const [i,m] of input.memorySamples.entries()){finiteNonNegative(`java memory ${i}`,m.javaBytes);finiteNonNegative(`native memory ${i}`,m.nativeBytes);finiteNonNegative(`gpu memory ${i}`,m.gpuBytes);peakJavaBytes=Math.max(peakJavaBytes,m.javaBytes);peakNativeBytes=Math.max(peakNativeBytes,m.nativeBytes);peakGpuBytes=Math.max(peakGpuBytes,m.gpuBytes);}
 const profile:HeroAndroidLodTelemetryProfile={schema:HERO_ANDROID_PROFILE_SCHEMA,device:{...input.device},build:{...input.build},measurement:{coldLoadMs:input.coldLoadMs,warmLoadMs:input.warmLoadMs,frames:frames.length,p95FrameMs:percentile(frames,.95),p99FrameMs:percentile(frames,.99),peakJavaBytes,peakNativeBytes,peakGpuBytes},lodTransitions:input.lodTransitions.map(t=>({...t}))};
 verifyHeroAndroidLodTelemetry(profile);return profile;
}

export class HeroAndroidLodTransitionRecorder{
 private readonly transitions:HeroLodMeasuredTransition[]=[];
 record(from:HeroLod,to:HeroLod,distanceM:number,frame:number,atMs:number,p95FrameMs:number,reason:HeroLodTransitionReason){
  const transition={from,to,distanceM,frame,atMs,p95FrameMs,reason};this.transitions.push(transition);return transition;
 }
 snapshot():readonly HeroLodMeasuredTransition[]{return this.transitions.map(t=>({...t}));}
}
