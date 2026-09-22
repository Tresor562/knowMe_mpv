import { describe, expect, it } from 'vitest';
import { AVATAR_ART_PIPELINE_STAGES, AVATAR_HERO_REQUIRED_VIEWS, AvatarHeroArtPackage, avatarGarmentVariantKey, validateAvatarHeroArtPackage } from './avatar-art-production.domain';

const hero=():AvatarHeroArtPackage=>({
  assetKey:'knowme.hero.reference.v1',originalDesign:true,
  referenceViews:Object.fromEntries(AVATAR_HERO_REQUIRED_VIEWS.map(v=>[v,`asset://concept/hero-${v.toLowerCase()}`])),
  sourceFormat:'BLEND',runtimeFormat:'GLB',commonSkeletonKey:'knowme.humanoid.v1',facialRigKey:'knowme.face.v1',pbrWorkflow:'METALLIC_ROUGHNESS',hairTechnique:'HAIR_CARDS',
  stages:AVATAR_ART_PIPELINE_STAGES.map((stage,index)=>({sourceRevision:`hero-src-${index}`,artistRevision:`hero-art-${index}`,stage,tool:stage==='PBR_TEXTURE'?'substance-painter':'blender',toolVersion:stage==='PBR_TEXTURE'?'10.1':'4.3',reviewedAt:'2026-09-22T12:00:00.000Z',reviewer:'avatar-art-lead'})),
});

describe('Avatar art production contract',()=>{
  it('accepts a Hero package only with evidence across the complete 3D pipeline',()=>expect(validateAvatarHeroArtPackage(hero())).toBeTruthy());
  it('rejects Hero packages missing a required multi-angle reference',()=>{const x=hero();delete x.referenceViews.THREE_QUARTER_BACK;expect(()=>validateAvatarHeroArtPackage(x)).toThrow(/THREE_QUARTER_BACK/);});
  it('rejects generated/concept-only packages that skip real runtime production stages',()=>{const x=hero();x.stages=x.stages.filter(s=>s.stage!=='RETOPOLOGY'&&s.stage!=='UV'&&s.stage!=='RUNTIME_EXPORT');expect(()=>validateAvatarHeroArtPackage(x)).toThrow(/RETOPOLOGY/);});
  it('rejects Hero packages without runtime certification evidence',()=>{const x=hero();x.stages=x.stages.filter(s=>s.stage!=='RUNTIME_CERTIFICATION');expect(()=>validateAvatarHeroArtPackage(x)).toThrow(/RUNTIME_CERTIFICATION/);});
  it('builds deterministic modular garment variant keys without duplicating meshes per colorway',()=>{const base={recipeKey:'street-tee-v1',silhouetteBase:'tee-base-a',sleeve:'short',collar:'crew',length:'regular',fit:'relaxed',material:'cotton-pbr',colorway:'obsidian',accessories:['chain-small','badge-round']};const a=avatarGarmentVariantKey(base),b=avatarGarmentVariantKey({...base,accessories:[...base.accessories].reverse()});expect(a).toBe(b);expect(a).toContain('tee-base-a');expect(a).toContain('cotton-pbr');});
});
