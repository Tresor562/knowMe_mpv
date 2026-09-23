import { validateAvatarAnimationManifest, AvatarAnimationManifest } from './avatar-animation-manifest.domain';

const facial=():AvatarAnimationManifest=>({manifestVersion:1,clipKey:'knowme.expression.smile.v1',kind:'FACIAL',uri:'asset://runtime/avatar/animations/smile-v1.glb',durationMs:900,loop:false,facialRigKey:'knowme.face.v1',drivenMorphTargets:['mouthSmileLeft','mouthSmileRight'],sampleRate:30});
const body=():AvatarAnimationManifest=>({manifestVersion:1,clipKey:'knowme.idle.neutral.v1',kind:'BODY',uri:'asset://runtime/avatar/animations/idle-neutral-v1.glb',durationMs:4000,loop:true,skeletonKey:'knowme.humanoid.v1',drivenMorphTargets:[],sampleRate:30});

describe('Avatar animation certification',()=>{
 it('accepts a facial clip targeting certified expression blendshapes',()=>expect(validateAvatarAnimationManifest(facial())).toEqual(facial()));
 it('accepts a body clip on the canonical skeleton',()=>expect(validateAvatarAnimationManifest(body())).toEqual(body()));
 it('rejects facial clips targeting a foreign rig',()=>{const x=facial();x.facialRigKey='other.face.v1';expect(()=>validateAvatarAnimationManifest(x)).toThrow(/canonical facial rig/i);});
 it('rejects facial clips driving uncertified blendshapes',()=>{const x=facial();x.drivenMorphTargets=['clientInjectedSmile'];expect(()=>validateAvatarAnimationManifest(x)).toThrow(/unsupported morph target/i);});
 it('rejects body clips targeting a foreign skeleton',()=>{const x=body();x.skeletonKey='other.humanoid.v1';expect(()=>validateAvatarAnimationManifest(x)).toThrow(/canonical avatar skeleton/i);});
 it('rejects external animation payloads',()=>{const x=facial();x.uri='https://evil.test/smile.glb';expect(()=>validateAvatarAnimationManifest(x)).toThrow(/internal certified runtime/i);});
 it('rejects path traversal and interchangeable query payloads',()=>{for(const uri of ['asset://runtime/avatar/animations/../smile.glb','asset://runtime/avatar/animations/smile.glb?v=2','asset://runtime/avatar/animations/smile.glb#other']){const x=facial();x.uri=uri;expect(()=>validateAvatarAnimationManifest(x)).toThrow(/internal certified runtime/i);}});
 it('rejects unknown authority metadata',()=>{const x=facial() as AvatarAnimationManifest&{premiumUnlocked?:boolean};x.premiumUnlocked=true;expect(()=>validateAvatarAnimationManifest(x)).toThrow(/Unknown avatar animation manifest field: premiumUnlocked/i);});
 it('returns detached morph target data',()=>{const x=facial();const y=validateAvatarAnimationManifest(x);expect(y).not.toBe(x);expect(y.drivenMorphTargets).not.toBe(x.drivenMorphTargets);});
});
