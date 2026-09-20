import {collectHeroAndroidProfile,HeroAndroidCollectorInput,HeroAndroidLodTransitionRecorder} from './hero-runtime-android-collector-v19.domain';
import {HERO_ANDROID_MIN_SAMPLE_FRAMES} from './hero-runtime-android-profile-v16.domain';
const base=():HeroAndroidCollectorInput=>({device:{manufacturer:'Reference',model:'Android-mid',androidApi:30,gpu:'Reference GPU',renderer:'Vulkan'},build:{appVersion:'1.0.0',commitSha:'a'.repeat(40),runtimeBundleSha256:'b'.repeat(64)},coldLoadMs:1800,warmLoadMs:600,frameTimesMs:Array.from({length:HERO_ANDROID_MIN_SAMPLE_FRAMES},(_,i)=>i<570?16:24),memorySamples:[{javaBytes:10,nativeBytes:20,gpuBytes:30},{javaBytes:15,nativeBytes:18,gpuBytes:40}],lodTransitions:[]});
describe('Hero Android collector v19',()=>{
 it('derives percentiles and memory peaks from raw samples',()=>{const p=collectHeroAndroidProfile(base());expect(p.measurement).toEqual(expect.objectContaining({frames:600,p95FrameMs:16,p99FrameMs:24,peakJavaBytes:15,peakNativeBytes:20,peakGpuBytes:40}));});
 it('does not accept caller supplied aggregate performance values',()=>{const i:any=base();i.p95FrameMs=1;i.peakGpuBytes=1;const p=collectHeroAndroidProfile(i);expect(p.measurement.p99FrameMs).toBe(24);expect(p.measurement.peakGpuBytes).toBe(40);});
 it('rejects non-finite raw frame samples',()=>{const i=base();(i.frameTimesMs as number[])[10]=Number.NaN;expect(()=>collectHeroAndroidProfile(i)).toThrow(/frame 10/);});
 it('rejects missing memory samples',()=>{const i=base();i.memorySamples=[];expect(()=>collectHeroAndroidProfile(i)).toThrow(/memory samples/);});
 it('feeds v18 telemetry validation',()=>{const i=base();i.lodTransitions=[{from:0,to:1,distanceM:3.2,frame:100,atMs:1000,p95FrameMs:31,reason:'frame-pressure'}];expect(collectHeroAndroidProfile(i).lodTransitions).toHaveLength(1);});
 it('records immutable transition snapshots',()=>{const r=new HeroAndroidLodTransitionRecorder();r.record(0,1,3.2,100,1000,31,'frame-pressure');const a=r.snapshot() as any[];a[0].reason='distance';expect(r.snapshot()[0].reason).toBe('frame-pressure');});
});
