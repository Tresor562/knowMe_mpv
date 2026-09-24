import { AVATAR_BALANCED_RENDER_PROFILE, validateAvatarRenderProfile } from './avatar-render-profile.domain';

describe('AvatarRenderProfile',()=>{
  const valid=()=>({
    ...AVATAR_BALANCED_RENDER_PROFILE,
    pbr:{...AVATAR_BALANCED_RENDER_PROFILE.pbr},
    turntable:{...AVATAR_BALANCED_RENDER_PROFILE.turntable},
    camera:{...AVATAR_BALANCED_RENDER_PROFILE.camera},
    android:{...AVATAR_BALANCED_RENDER_PROFILE.android}
  });

  it('accepts and canonicalizes the certified Android balanced 360 profile',()=>{
    expect(validateAvatarRenderProfile(valid())).toEqual(AVATAR_BALANCED_RENDER_PROFILE);
  });

  it.each([
    ['client authority injection',(p:any)=>{p.premiumUnlocked=true;}],
    ['disabled IBL',(p:any)=>{p.pbr.imageBasedLighting=false;}],
    ['non-360 turntable',(p:any)=>{p.turntable.degrees=359;}],
    ['uncertified tone mapper',(p:any)=>{p.pbr.toneMapper='LINEAR';}],
    ['uncompressed Android textures',(p:any)=>{p.android.textureCompression='PNG';}],
    ['excessive triangle budget',(p:any)=>{p.android.maxVisibleTriangles=90_001;}],
    ['excessive draw calls',(p:any)=>{p.android.maxDrawCalls=71;}],
    ['excessive texture memory',(p:any)=>{p.android.maxTextureMemoryMiB=129;}],
    ['excessive skinned meshes',(p:any)=>{p.android.maxSkinnedMeshes=13;}],
    ['excessive bones per draw',(p:any)=>{p.android.maxBonesPerDraw=97;}],
    ['slow GPU budget',(p:any)=>{p.android.maxGpuFrameMs=16.68;}],
    ['unsafe camera near plane',(p:any)=>{p.camera.nearMeters=0.001;}],
    ['too sparse turntable sampling',(p:any)=>{p.turntable.framesPerRevolution=59;}]
  ])('rejects %s',(_label,mutate)=>{
    const profile:any=valid(); mutate(profile);
    expect(()=>validateAvatarRenderProfile(profile)).toThrow();
  });

  it('does not trust a higher tier to smuggle a balanced profile over its declared tier budget',()=>{
    const profile:any=valid();
    profile.tier='REALTIME_3D_BALANCED';
    profile.android.maxVisibleTriangles=160_000;
    expect(()=>validateAvatarRenderProfile(profile)).toThrow('maxVisibleTriangles');
  });

  it('returns a detached canonical projection rather than the caller nested objects',()=>{
    const source:any=valid();
    const certified=validateAvatarRenderProfile(source);
    source.android.maxDrawCalls=999;
    source.pbr.maxDynamicLights=4;
    expect(certified.android.maxDrawCalls).toBe(70);
    expect(certified.pbr.maxDynamicLights).toBe(2);
  });
});
