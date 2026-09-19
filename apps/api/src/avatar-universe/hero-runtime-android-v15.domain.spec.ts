import {estimateHeroAndroidResidency,HERO_RUNTIME_ANDROID_MAX_RESIDENT_BYTES,HERO_RUNTIME_ANDROID_MAX_TRIANGLES,HERO_RUNTIME_ANDROID_MAX_VERTICES} from './hero-runtime-android-v15.domain';

describe('Hero runtime Android v15',()=>{
 it('accounts geometry, all morph POSITION buffers, textures and skin reserve',()=>{
  const r=estimateHeroAndroidResidency(2,1000,500,4*1024*1024);
  expect(r.estimatedGeometryBytes).toBe(1000*72+500*3*4+256*64);
  expect(r.estimatedMorphBytes).toBeGreaterThan(0);
  expect(r.estimatedResidentBytes).toBe(r.estimatedGeometryBytes+r.estimatedMorphBytes+r.textureBytes);
 });
 it.each([0,1,2] as const)('accepts a realistic LOD%i footprint below its ceiling',level=>{
  const r=estimateHeroAndroidResidency(level,Math.floor(HERO_RUNTIME_ANDROID_MAX_VERTICES[level]/4),Math.floor(HERO_RUNTIME_ANDROID_MAX_TRIANGLES[level]/4),1024*1024);
  expect(r.estimatedResidentBytes).toBeLessThan(r.residentBudgetBytes);
 });
 it('rejects excess vertices independently of triangle count',()=>expect(()=>estimateHeroAndroidResidency(2,HERO_RUNTIME_ANDROID_MAX_VERTICES[2]+1,1,0)).toThrow(/vertex budget/));
 it('rejects excess triangles independently of vertex count',()=>expect(()=>estimateHeroAndroidResidency(1,3,HERO_RUNTIME_ANDROID_MAX_TRIANGLES[1]+1,0)).toThrow(/triangle budget/));
 it('rejects residency overflow even when geometry is within geometric ceilings',()=>expect(()=>estimateHeroAndroidResidency(2,100,100,HERO_RUNTIME_ANDROID_MAX_RESIDENT_BYTES[2])).toThrow(/GPU residency/));
 it.each([['vertices',-1,1,0],['triangles',1,-1,0],['textureBytes',1,1,-1]] as const)('rejects invalid %s metrics',(_,v,t,x)=>expect(()=>estimateHeroAndroidResidency(0,v,t,x)).toThrow(/metric is invalid/));
});
