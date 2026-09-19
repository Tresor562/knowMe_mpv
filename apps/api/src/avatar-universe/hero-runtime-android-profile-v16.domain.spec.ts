import {HERO_ANDROID_PROFILE_SCHEMA,HERO_ANDROID_MIN_SAMPLE_FRAMES,verifyHeroAndroidMeasuredProfile} from './hero-runtime-android-profile-v16.domain';

const valid=()=>({schema:HERO_ANDROID_PROFILE_SCHEMA,device:{manufacturer:'Reference',model:'Android-mid',androidApi:30,gpu:'Reference GPU',renderer:'Vulkan'},build:{appVersion:'1.0.0',commitSha:'a'.repeat(40),runtimeBundleSha256:'b'.repeat(64)},measurement:{coldLoadMs:1800,warmLoadMs:600,frames:HERO_ANDROID_MIN_SAMPLE_FRAMES,p95FrameMs:22,p99FrameMs:31,peakJavaBytes:20_000_000,peakNativeBytes:30_000_000,peakGpuBytes:40_000_000},lodTransitions:[{from:0 as const,to:1 as const,distanceM:3,frame:200},{from:1 as const,to:2 as const,distanceM:6,frame:400}]});

describe('Hero runtime measured Android profile v16',()=>{
 it('accepts a provenance-bound measured run within budgets',()=>expect(verifyHeroAndroidMeasuredProfile(valid())).toBeTruthy());
 it('rejects fabricated/absent provenance identifiers',()=>{const p=valid();p.build.runtimeBundleSha256='nope';expect(()=>verifyHeroAndroidMeasuredProfile(p)).toThrow(/bundle SHA-256/);});
 it('requires a substantial frame sample',()=>{const p=valid();p.measurement.frames=599;expect(()=>verifyHeroAndroidMeasuredProfile(p)).toThrow(/sample/);});
 it.each([['coldLoadMs',2501,/cold-load/],['warmLoadMs',901,/warm-load/],['p95FrameMs',33.35,/p95/],['p99FrameMs',50.01,/p99/]] as const)('rejects measured %s budget overflow',(field,value,error)=>{const p=valid();(p.measurement as any)[field]=value;if(field==='warmLoadMs')p.measurement.coldLoadMs=1000;if(field==='p95FrameMs')p.measurement.p99FrameMs=40;expect(()=>verifyHeroAndroidMeasuredProfile(p)).toThrow(error);});
 it('rejects impossible percentile ordering',()=>{const p=valid();p.measurement.p95FrameMs=32;p.measurement.p99FrameMs=31;expect(()=>verifyHeroAndroidMeasuredProfile(p)).toThrow(/p95/);});
 it('rejects non-adjacent LOD jumps',()=>{const p=valid();p.lodTransitions=[{from:0,to:2,distanceM:4,frame:100} as any];expect(()=>verifyHeroAndroidMeasuredProfile(p)).toThrow(/transition/);});
 it('rejects transition frames outside the measured run',()=>{const p=valid();p.lodTransitions=[{from:0,to:1,distanceM:3,frame:p.measurement.frames}];expect(()=>verifyHeroAndroidMeasuredProfile(p)).toThrow(/frame/);});
 it('rejects non-finite measured values',()=>{const p=valid();p.measurement.peakGpuBytes=Number.NaN;expect(()=>verifyHeroAndroidMeasuredProfile(p)).toThrow(/invalid/);});
});
