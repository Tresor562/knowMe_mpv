import {HERO_ANDROID_MIN_SAMPLE_FRAMES,HERO_ANDROID_PROFILE_SCHEMA} from './hero-runtime-android-profile-v16.domain';
import {HERO_LOD_MIN_RESIDENCY_MS} from './hero-runtime-lod-policy-v17.domain';
import {HeroAndroidLodTelemetryProfile,verifyHeroAndroidLodTelemetry} from './hero-runtime-lod-telemetry-v18.domain';
const valid=():HeroAndroidLodTelemetryProfile=>({schema:HERO_ANDROID_PROFILE_SCHEMA,device:{manufacturer:'Reference',model:'Android-mid',androidApi:30,gpu:'Reference GPU',renderer:'Vulkan'},build:{appVersion:'1.0.0',commitSha:'a'.repeat(40),runtimeBundleSha256:'b'.repeat(64)},measurement:{coldLoadMs:1800,warmLoadMs:600,frames:HERO_ANDROID_MIN_SAMPLE_FRAMES,p95FrameMs:22,p99FrameMs:31,peakJavaBytes:20_000_000,peakNativeBytes:30_000_000,peakGpuBytes:40_000_000},lodTransitions:[{from:0,to:1,distanceM:3.2,frame:100,atMs:1000,p95FrameMs:24,reason:'distance'},{from:1,to:2,distanceM:3.2,frame:220,atMs:2000,p95FrameMs:31,reason:'frame-pressure'}]});
describe('Hero runtime LOD telemetry v18',()=>{
 it('accepts chronological reasoned transitions and returns analysis',()=>expect(verifyHeroAndroidLodTelemetry(valid()).analysis).toEqual(expect.objectContaining({transitions:2,oscillations:0})));
 it('rejects dishonest frame-pressure attribution',()=>{const p=valid();p.lodTransitions[1].p95FrameMs=29;expect(()=>verifyHeroAndroidLodTelemetry(p)).toThrow(/Frame-pressure/);});
 it('rejects recovery while frame time is not healthy',()=>{const p=valid();p.lodTransitions=[{from:1,to:0,distanceM:2,frame:100,atMs:1000,p95FrameMs:23,reason:'recovery'}];expect(()=>verifyHeroAndroidLodTelemetry(p)).toThrow(/Recovery/);});
 it('rejects transitions faster than policy residency',()=>{const p=valid();p.lodTransitions[1].atMs=p.lodTransitions[0].atMs+HERO_LOD_MIN_RESIDENCY_MS-1;expect(()=>verifyHeroAndroidLodTelemetry(p)).toThrow(/residency/);});
 it('rejects non-chronological frame telemetry',()=>{const p=valid();p.lodTransitions[1].frame=p.lodTransitions[0].frame;expect(()=>verifyHeroAndroidLodTelemetry(p)).toThrow(/chronological/);});
 it('rejects excessive transition churn',()=>{const p=valid();p.lodTransitions=Array.from({length:13},(_,i)=>({from:(i%2?1:0) as 0|1,to:(i%2?0:1) as 0|1,distanceM:3.2,frame:i*40,atMs:1000+i*800,p95FrameMs:i%2?20:31,reason:(i%2?'recovery':'frame-pressure') as const}));expect(()=>verifyHeroAndroidLodTelemetry(p)).toThrow(/transition-rate|oscillation/);});
 it('rejects non-finite transition samples',()=>{const p=valid();p.lodTransitions[0].atMs=Number.NaN;expect(()=>verifyHeroAndroidLodTelemetry(p)).toThrow(/invalid/);});
});
