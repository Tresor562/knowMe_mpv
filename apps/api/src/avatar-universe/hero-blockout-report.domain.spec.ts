import { HERO_BLOCKOUT_REPORT_VERSION, HeroBlockoutReport, validateHeroBlockoutReport } from './hero-blockout-report.domain';
import { AVATAR_CANONICAL_SKELETON } from './avatar-asset-manifest.domain';

const valid=():HeroBlockoutReport=>({reportVersion:HERO_BLOCKOUT_REPORT_VERSION,assetKey:'knowme.hero.blockout.v1',unitSystem:'METERS',runtimeUpAxis:'Y',pose:'A_POSE',centeredWorldOrigin:true,groundContactY:0,bodyHeightMeters:1.68,skeletonTarget:AVATAR_CANONICAL_SKELETON,stableVertexOrder:true,deformationTopologyReady:true,objects:[{role:'BODY',vertices:30000,triangles:45000,manifold:true,unappliedTransforms:false,fusedClothingOrAccessories:false},{role:'EYE_L',vertices:800,triangles:1400,manifold:true,unappliedTransforms:false,fusedClothingOrAccessories:false},{role:'EYE_R',vertices:800,triangles:1400,manifold:true,unappliedTransforms:false,fusedClothingOrAccessories:false},{role:'HAIR_PLACEHOLDER',vertices:2500,triangles:4000,manifold:true,unappliedTransforms:false,fusedClothingOrAccessories:false}]});

describe('Hero blockout production gate',()=>{
 it('accepts a measurable clean A-pose blockout report',()=>expect(validateHeroBlockoutReport(valid())).toBeDefined());
 it('rejects missing separate eyes',()=>{const x=valid();x.objects=x.objects.filter(o=>o.role!=='EYE_R');expect(()=>validateHeroBlockoutReport(x)).toThrow(/EYE_R/);});
 it('rejects non-manifold geometry',()=>{const x=valid();x.objects[0].manifold=false;expect(()=>validateHeroBlockoutReport(x)).toThrow(/non-manifold/);});
 it('rejects fused cosmetics',()=>{const x=valid();x.objects[0].fusedClothingOrAccessories=true;expect(()=>validateHeroBlockoutReport(x)).toThrow(/fused/);});
 it('rejects unlocked vertex order',()=>{const x=valid();x.stableVertexOrder=false;expect(()=>validateHeroBlockoutReport(x)).toThrow(/vertex order/);});
 it('rejects geometry beyond mobile-oriented blockout budget',()=>{const x=valid();x.objects[0].triangles=60001;expect(()=>validateHeroBlockoutReport(x)).toThrow(/budget/);});
 it('rejects duplicate object roles',()=>{const x=valid();x.objects.push({...x.objects[1]});expect(()=>validateHeroBlockoutReport(x)).toThrow(/unique/);});
});
