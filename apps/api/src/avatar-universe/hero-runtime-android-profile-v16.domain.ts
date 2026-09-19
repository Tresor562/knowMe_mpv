import {createHash} from 'node:crypto';
import {HeroRuntimeBundle} from './hero-runtime-bundle-v13.domain';
import {verifyHeroRuntimeBundleAndroidBytes} from './hero-runtime-android-v15.domain';

export const HERO_RUNTIME_ANDROID_PROFILE_GATE_VERSION=16 as const;
export const HERO_ANDROID_PROFILE_SCHEMA='knowme.hero.android.profile.v1' as const;
export const HERO_ANDROID_MAX_COLD_LOAD_MS=2500,HERO_ANDROID_MAX_WARM_LOAD_MS=900,HERO_ANDROID_MAX_P95_FRAME_MS=33.34,HERO_ANDROID_MAX_P99_FRAME_MS=50,HERO_ANDROID_MIN_SAMPLE_FRAMES=600;
export type HeroAndroidMeasuredProfile={schema:typeof HERO_ANDROID_PROFILE_SCHEMA;device:{manufacturer:string;model:string;androidApi:number;gpu:string;renderer:string};build:{appVersion:string;commitSha:string;runtimeBundleSha256:string};measurement:{coldLoadMs:number;warmLoadMs:number;frames:number;p95FrameMs:number;p99FrameMs:number;peakJavaBytes:number;peakNativeBytes:number;peakGpuBytes:number};lodTransitions:Array<{from:0|1|2;to:0|1|2;distanceM:number;frame:number}>};
const finiteNonNegative=(name:string,value:number)=>{if(!Number.isFinite(value)||value<0)throw new Error(`Android profile ${name} is invalid.`);};
const nonEmpty=(name:string,value:string)=>{if(typeof value!=='string'||value.trim().length===0)throw new Error(`Android profile ${name} is required.`);};

export function heroRuntimeBundleFingerprint(bundle:HeroRuntimeBundle){
 const canonical={bundleVersion:bundle.bundleVersion,assetKey:bundle.assetKey,format:bundle.format,skeletonKey:bundle.skeletonKey,morphTargets:bundle.morphTargets,lods:bundle.lods.map(l=>({level:l.level,fileName:l.fileName,sha256:l.sha256,downloadBytes:l.downloadBytes,vertices:l.vertices,triangles:l.triangles}))};
 return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
export function verifyHeroAndroidMeasuredProfile(profile:HeroAndroidMeasuredProfile){
 if(profile?.schema!==HERO_ANDROID_PROFILE_SCHEMA)throw new Error('Android profile schema is invalid.');
 nonEmpty('manufacturer',profile.device?.manufacturer);nonEmpty('model',profile.device?.model);nonEmpty('gpu',profile.device?.gpu);nonEmpty('renderer',profile.device?.renderer);
 if(!Number.isSafeInteger(profile.device?.androidApi)||profile.device.androidApi<26)throw new Error('Android profile API level is invalid.');
 nonEmpty('appVersion',profile.build?.appVersion);nonEmpty('commitSha',profile.build?.commitSha);nonEmpty('runtimeBundleSha256',profile.build?.runtimeBundleSha256);
 if(!/^[0-9a-f]{40}$/i.test(profile.build.commitSha))throw new Error('Android profile commit SHA is invalid.');
 if(!/^[0-9a-f]{64}$/i.test(profile.build.runtimeBundleSha256))throw new Error('Android profile runtime bundle SHA-256 is invalid.');
 const m=profile.measurement;for(const [name,value] of Object.entries({coldLoadMs:m?.coldLoadMs,warmLoadMs:m?.warmLoadMs,p95FrameMs:m?.p95FrameMs,p99FrameMs:m?.p99FrameMs,peakJavaBytes:m?.peakJavaBytes,peakNativeBytes:m?.peakNativeBytes,peakGpuBytes:m?.peakGpuBytes}))finiteNonNegative(name,value as number);
 if(!Number.isSafeInteger(m?.frames)||m.frames<HERO_ANDROID_MIN_SAMPLE_FRAMES)throw new Error('Android profile frame sample is too small.');
 if(m.warmLoadMs>m.coldLoadMs)throw new Error('Android warm load cannot exceed cold load in a certified run.');if(m.p95FrameMs>m.p99FrameMs)throw new Error('Android p95 frame time cannot exceed p99.');
 if(m.coldLoadMs>HERO_ANDROID_MAX_COLD_LOAD_MS)throw new Error('Android cold-load budget exceeded.');if(m.warmLoadMs>HERO_ANDROID_MAX_WARM_LOAD_MS)throw new Error('Android warm-load budget exceeded.');if(m.p95FrameMs>HERO_ANDROID_MAX_P95_FRAME_MS)throw new Error('Android p95 frame-time budget exceeded.');if(m.p99FrameMs>HERO_ANDROID_MAX_P99_FRAME_MS)throw new Error('Android p99 frame-time budget exceeded.');
 for(const t of profile.lodTransitions??[]){if(!([0,1,2].includes(t.from)&&[0,1,2].includes(t.to))||Math.abs(t.from-t.to)!==1)throw new Error('Android LOD transition is invalid.');finiteNonNegative('LOD distance',t.distanceM);if(!Number.isSafeInteger(t.frame)||t.frame<0||t.frame>=m.frames)throw new Error('Android LOD transition frame is invalid.');}
 return profile;
}
export function certifyHeroRuntimeAndroidMeasured(bundle:HeroRuntimeBundle,files:ReadonlyMap<string,Uint8Array>,profile:HeroAndroidMeasuredProfile){
 const staticCertification=verifyHeroRuntimeBundleAndroidBytes(bundle,files),measuredProfile=verifyHeroAndroidMeasuredProfile(profile);
 if(measuredProfile.build.runtimeBundleSha256.toLowerCase()!==heroRuntimeBundleFingerprint(bundle))throw new Error('Android measured profile does not belong to this certified Hero runtime bundle.');
 return {gateVersion:HERO_RUNTIME_ANDROID_PROFILE_GATE_VERSION,staticCertification,measuredProfile};
}
