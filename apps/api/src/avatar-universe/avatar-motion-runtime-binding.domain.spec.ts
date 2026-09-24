import { AvatarAnimationManifest } from './avatar-animation-manifest.domain';
import { AvatarEmotePackManifest } from './avatar-emote-pack-manifest.domain';
import { AVATAR_EMOTE_PACK_BINDINGS, AVATAR_MOTION_BINDINGS, bindCertifiedAvatarEmotePack, bindCertifiedAvatarMotion, isKnownAvatarMotionKey } from './avatar-motion-runtime-binding.domain';

const evidence=(payload='a')=>({payloadSha256:payload.repeat(64),payloadBytes:256_000,manifestSha256:'b'.repeat(64),certifiedAt:'2026-09-23T22:00:00.000Z'});
const body=(clipKey='knowme.idle.neutral.v1',loop=true,payload='a'):AvatarAnimationManifest=>({manifestVersion:1,clipKey,kind:'BODY',uri:`asset://runtime/avatar/animations/${clipKey}.glb`,durationMs:4000,loop,skeletonKey:'knowme.humanoid.v1',drivenMorphTargets:[],sampleRate:30,...evidence(payload)});
const pack=(packKey='knowme.emotes.core.v1'):AvatarEmotePackManifest=>({manifestVersion:1,packKey,clips:[body('knowme.emote.wave.v1',false,'a'),body('knowme.emote.nod.v1',false,'c')],manifestSha256:'d'.repeat(64),certifiedAt:'2026-09-23T22:00:00.000Z'});

// Contract fixtures only: they do not claim that these GLB binaries exist in production.
describe('Avatar motion runtime binding',()=>{
  it('keeps DNA keys separate from concrete certified clip identities',()=>{
    expect(AVATAR_MOTION_BINDINGS['idle-neutral-v1'].clipKey).toBe('knowme.idle.neutral.v1');
    expect(AVATAR_EMOTE_PACK_BINDINGS['emotes-core-v1'].packKey).toBe('knowme.emotes.core.v1');
    expect(isKnownAvatarMotionKey('idleAnimation','idle-neutral-v1')).toBe(true);
    expect(isKnownAvatarMotionKey('signaturePose','idle-neutral-v1')).toBe(false);
    expect(isKnownAvatarMotionKey('emotePackKey','emotes-core-v1')).toBe(true);
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

  it('binds an emote DNA key to a certified multi-clip pack, not a pretend single clip',()=>{
    const certified=bindCertifiedAvatarEmotePack('emotes-core-v1',pack());
    expect(certified.packKey).toBe('knowme.emotes.core.v1');
    expect(certified.clips).toHaveLength(2);
    expect(certified.clips.every(clip=>clip.loop===false)).toBe(true);
  });

  it('rejects substituted, single-clip, looping, duplicate-payload and forged emote packs',()=>{
    expect(()=>bindCertifiedAvatarEmotePack('emotes-core-v1',pack('knowme.emotes.attacker.v1'))).toThrow(/does not match/i);
    expect(()=>bindCertifiedAvatarEmotePack('emotes-core-v1',{...pack(),clips:[body('knowme.emote.wave.v1',false)]})).toThrow(/2-32/i);
    expect(()=>bindCertifiedAvatarEmotePack('emotes-core-v1',{...pack(),clips:[body('knowme.emote.wave.v1',true,'a'),body('knowme.emote.nod.v1',false,'c')]})).toThrow(/non-looping/i);
    expect(()=>bindCertifiedAvatarEmotePack('emotes-core-v1',{...pack(),clips:[body('knowme.emote.wave.v1',false,'a'),body('knowme.emote.nod.v1',false,'a')]})).toThrow(/same certified GLB payload/i);
    expect(()=>bindCertifiedAvatarEmotePack('emotes-core-v1',{...pack(),premiumUnlocked:true} as AvatarEmotePackManifest)).toThrow(/Unknown avatar emote pack manifest field/i);
  });
});
