import {HERO_ANDROID_MIN_SAMPLE_FRAMES} from './hero-runtime-android-profile-v16.domain';
import {HeroAndroidMeasuredSession} from './hero-runtime-android-session-v20.domain';

const device={manufacturer:'Reference',model:'Android-mid',androidApi:30,gpu:'Reference GPU',renderer:'Vulkan'};
const build={appVersion:'1.0.0',commitSha:'a'.repeat(40),runtimeBundleSha256:'b'.repeat(64)};
const fill=(session:HeroAndroidMeasuredSession)=>{for(let i=0;i<HERO_ANDROID_MIN_SAMPLE_FRAMES;i++)session.recordFrame(i<570?16:24);session.recordMemory({javaBytes:10,nativeBytes:20,gpuBytes:30});};

describe('Hero Android measured session v20',()=>{
 it('seals one run and derives a collector profile from its own samples',()=>{let now=1000;const s=new HeroAndroidMeasuredSession(device,build,()=>now,'session-a' as any);fill(s);now=3000;const result=s.finish(1800,600);expect(result.identity.sessionId).toBe('session-a');expect(result.profile.measurement).toEqual(expect.objectContaining({frames:600,p95FrameMs:16,p99FrameMs:24,peakGpuBytes:30}));expect(result.evidenceSha256).toMatch(/^[a-f0-9]{64}$/);expect(s.snapshot().sealed).toBe(true);});
 it('rejects writes after sealing',()=>{let now=1000;const s=new HeroAndroidMeasuredSession(device,build,()=>now,'session-b' as any);fill(s);now=3000;s.finish(1800,600);expect(()=>s.recordFrame(16)).toThrow(/sealed/);expect(()=>s.recordMemory({javaBytes:1,nativeBytes:1,gpuBytes:1})).toThrow(/sealed/);});
 it('keeps device and build identity immutable from caller mutations',()=>{const d={...device};const b={...build};const s=new HeroAndroidMeasuredSession(d,b,()=>1000,'session-c' as any);d.model='tampered';b.runtimeBundleSha256='c'.repeat(64);expect(s.snapshot().identity.device.model).toBe('Android-mid');expect(s.snapshot().identity.build.runtimeBundleSha256).toBe('b'.repeat(64));});
 it('produces different evidence digests for different raw samples',()=>{let now=1000;const a=new HeroAndroidMeasuredSession(device,build,()=>now,'same-session' as any);const b=new HeroAndroidMeasuredSession(device,build,()=>now,'same-session' as any);fill(a);fill(b);b.recordFrame(17);now=3000;const ra=a.finish(1800,600);const rb=b.finish(1800,600);expect(ra.evidenceSha256).not.toBe(rb.evidenceSha256);});
 it('rejects an end timestamp before session start',()=>{let now=2000;const s=new HeroAndroidMeasuredSession(device,build,()=>now,'session-d' as any);fill(s);now=1000;expect(()=>s.finish(1800,600)).toThrow(/precedes start/);});
});
