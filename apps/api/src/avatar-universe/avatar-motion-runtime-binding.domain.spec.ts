import { AvatarAnimationManifest } from './avatar-animation-manifest.domain';
import { AVATAR_MOTION_BINDINGS, bindCertifiedAvatarMotion, isKnownAvatarMotionKey } from './avatar-motion-runtime-binding.domain';

const evidence=()=>({payloadSha256:'a'.repeat(64),payloadBytes:256_000,manifestSha256:'b'.repeat(64),certifiedAt:'2026-09-23T22:00:00.000Z'});
const body=(clipKey='knowme.idle.neutral.v1'):AvatarAnimationManifest=>({manifestVersion:1,clipKey,kind:'BODY',uri:'asset://runtime/avatar/animations/idle-neutral-v1.glb',durationMs:4000,loop:true,skeletonKey:'knowme.humanoid.v1',drivenMorphTargets:[],sampleRate:30,...evidence()});

// These manifests are contract fixtures only. They do not claim that the binary
// GLBs exist in production; production readiness additionally requires the
// certification pipeline to supply matching immutable evidence.
describe('Avatar motion runtime binding',()=>{
  it('keeps DNA keys separate from concrete certified clip identities',()=>{
    expect(AVATAR_MOTION_BINDINGS['idle-neutral-v1'].clipKey).toBe('knowme.idle.neutral.v1');
    expect(isKnownAvatarMotionKey('idleAnimation','idle-neutral-v1')).toBe(true);
    expect(isKnownAvatarMotionKey('signaturePose','idle-neutral-v1')).toBe(false);
  });

  it('accepts only a certified manifest whose clip identity matches the logical DNA key',()=>{
    expect(bindCertifiedAvatarMotion('idleAnimation','idle-neutral-v1',body()).clipKey).toBe('knowme.idle.neutral.v1');
    expect(()=>bindCertifiedAvatarMotion('idleAnimation','idle-neutral-v1',body('knowme.idle.attacker.v1'))).toThrow(/does not match/i);
  });

  it('cannot bypass immutable certification while resolving a DNA key',()=>{
    const forged={...body(),payloadSha256:'client-controlled'} as AvatarAnimationManifest;
    expect(()=>bindCertifiedAvatarMotion('idleAnimation','idle-neutral-v1',forged)).toThrow(/SHA-256/i);
  });

  it('rejects cross-field and unknown logical motion keys',()=>{
    expect(()=>bindCertifiedAvatarMotion('signaturePose','idle-neutral-v1',body())).toThrow(/Unknown avatar motion key/i);
    expect(()=>bindCertifiedAvatarMotion('idleAnimation','client-upload-v1',body())).toThrow(/Unknown avatar motion key/i);
  });

  it('rejects a facial-only clip for a body idle binding',()=>{
    const facial:AvatarAnimationManifest={...body(),kind:'FACIAL',skeletonKey:undefined,facialRigKey:'knowme.face.v1',drivenMorphTargets:['mouthSmileLeft'],clipKey:'knowme.idle.neutral.v1'};
    expect(()=>bindCertifiedAvatarMotion('idleAnimation','idle-neutral-v1',facial)).toThrow(/incompatible/i);
  });
});
