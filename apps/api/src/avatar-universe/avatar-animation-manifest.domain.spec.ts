import { validateAvatarAnimationManifest, AvatarAnimationManifest } from './avatar-animation-manifest.domain';

const evidence=()=>({payloadSha256:'a'.repeat(64),payloadBytes:256_000,manifestSha256:'b'.repeat(64),certifiedAt:'2026-09-23T22:00:00.000Z'});
const facial=():AvatarAnimationManifest=>({manifestVersion:1,clipKey:'knowme.expression.smile.v1',kind:'FACIAL',uri:'asset://runtime/avatar/animations/smile-v1.glb',durationMs:900,loop:false,facialRigKey:'knowme.face.v1',drivenMorphTargets:['mouthSmileLeft','mouthSmileRight'],sampleRate:30,...evidence()});
const body=():AvatarAnimationManifest=>({manifestVersion:1,clipKey:'knowme.idle.neutral.v1',kind:'BODY',uri:'asset://runtime/avatar/animations/idle-neutral-v1.glb',durationMs:4000,loop:true,skeletonKey:'knowme.humanoid.v1',drivenMorphTargets:[],sampleRate:30,...evidence()});

describe('Avatar animation certification',()=>{
 it('accepts a facial clip targeting certified expression blendshapes with immutable evidence',()=>expect(validateAvatarAnimationManifest(facial())).toEqual(facial()));
 it('accepts a body clip on the canonical skeleton with immutable evidence',()=>expect(validateAvatarAnimationManifest(body())).toEqual(body()));
 it('rejects facial clips targeting a foreign rig',()=>{const x=facial();x.facialRigKey='other.face.v1';expect(()=>validateAvatarAnimationManifest(x)).toThrow(/canonical facial rig/i);});
 it('rejects facial clips driving uncertified blendshapes',()=>{const x=facial();x.drivenMorphTargets=['clientInjectedSmile'];expect(()=>validateAvatarAnimationManifest(x)).toThrow(/unsupported morph target/i);});
 it('rejects body clips targeting a foreign skeleton',()=>{const x=body();x.skeletonKey='other.humanoid.v1';expect(()=>validateAvatarAnimationManifest(x)).toThrow(/canonical avatar skeleton/i);});
 it('rejects external, traversed, non-GLB and interchangeable animation payloads',()=>{for(const uri of ['https://evil.test/smile.glb','asset://runtime/avatar/animations/../smile.glb','asset://runtime/avatar/animations/smile.glb?v=2','asset://runtime/avatar/animations/smile.glb#other','asset://runtime/avatar/animations/smile.fbx']){const x=facial();x.uri=uri;expect(()=>validateAvatarAnimationManifest(x)).toThrow(/internal certified runtime GLB/i);}});
 it('rejects unknown authority metadata',()=>{const x=facial() as AvatarAnimationManifest&{premiumUnlocked?:boolean};x.premiumUnlocked=true;expect(()=>validateAvatarAnimationManifest(x)).toThrow(/Unknown avatar animation manifest field: premiumUnlocked/i);});
 it.each([
   ['missing payload digest',{payloadSha256:undefined}],['malformed payload digest',{payloadSha256:'client-digest'}],
   ['missing manifest digest',{manifestSha256:undefined}],['malformed manifest digest',{manifestSha256:'client-manifest'}],
   ['zero-byte payload',{payloadBytes:0}],['fractional payload size',{payloadBytes:1.5}],
   ['invalid certification time',{certifiedAt:'not-a-date'}],['future certification time',{certifiedAt:'2099-01-01T00:00:00.000Z'}]
 ])('rejects %s',(_label,patch)=>{const x={...facial(),...patch} as AvatarAnimationManifest;expect(()=>validateAvatarAnimationManifest(x)).toThrow();});
 it('canonicalizes digests and returns detached morph target data',()=>{const x=facial();x.payloadSha256='A'.repeat(64);x.manifestSha256='B'.repeat(64);const y=validateAvatarAnimationManifest(x);expect(y).not.toBe(x);expect(y.drivenMorphTargets).not.toBe(x.drivenMorphTargets);expect(y.payloadSha256).toBe('a'.repeat(64));expect(y.manifestSha256).toBe('b'.repeat(64));});
});
