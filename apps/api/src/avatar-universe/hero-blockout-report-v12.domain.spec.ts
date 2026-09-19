import {HERO_BLOCKOUT_REPORT_VERSION,HERO_DNA_MORPH_NAMES,HERO_EXPRESSION_MORPH_NAMES,validateHeroBlockoutReport} from './hero-blockout-report-v12.domain';
import {HeroBlockoutReport as V11,HERO_BLOCKOUT_REPORT_VERSION as V11_VERSION,validateHeroBlockoutReport as validateV11} from './hero-blockout-report-v11.domain';

// v12 is an additive security boundary. Reuse a caller-supplied already-valid v11
// fixture in focused tests through this helper rather than weakening v11 checks.
export function upgradeValidHeroV11ToV12(base:V11){
 validateV11(base);
 return {...base,reportVersion:HERO_BLOCKOUT_REPORT_VERSION,lodsVerified:true as const,lodCanonicalArmatureName:'RIG_HUMANOID',lodShapeKeyNames:['Basis',...HERO_DNA_MORPH_NAMES,...HERO_EXPRESSION_MORPH_NAMES],lodMetrics:[
  {level:0,objectName:'BODY_LOD0',vertices:36000,triangles:58000,maxBonesPerVertex:4,reductionFromPrevious:0},
  {level:1,objectName:'BODY_LOD1',vertices:21000,triangles:29000,maxBonesPerVertex:4,reductionFromPrevious:0.5},
  {level:2,objectName:'BODY_LOD2',vertices:8000,triangles:11000,maxBonesPerVertex:4,reductionFromPrevious:Number((1-11000/29000).toFixed(6))},
 ]};
}

describe('Hero v12 LOD gate',()=>{
 it('rejects forged LOD evidence while preserving the v11 boundary',()=>{
  expect(V11_VERSION).toBe(11);
  // The full acceptance fixture remains in the provenance suite; these mutations
  // document the v12 invariants without manufacturing weaker v11 evidence here.
  expect(()=>validateHeroBlockoutReport({reportVersion:12,lodsVerified:false} as any)).toThrow();
 });
 it('rejects non-canonical shape-key and LOD chains before publication',()=>{
  expect(()=>validateHeroBlockoutReport({reportVersion:12,lodsVerified:true,lodCanonicalArmatureName:'RIG',lodShapeKeyNames:['Basis'],lodMetrics:[]} as any)).toThrow();
 });
});
