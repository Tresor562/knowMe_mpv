import { AVATAR_CANONICAL_SKELETON } from './avatar-asset-manifest.domain';
import {
  HERO_BLOCKOUT_ASSET_KEY,HERO_BLOCKOUT_REPORT_VERSION,HERO_DNA_MORPH_NAMES,
  HERO_EXPRESSION_MORPH_NAMES,HeroBlockoutReport,validateHeroBlockoutReport,
} from './hero-blockout-report-v10.domain';

const valid=():HeroBlockoutReport=>({
 reportVersion:HERO_BLOCKOUT_REPORT_VERSION,assetKey:HERO_BLOCKOUT_ASSET_KEY,unitSystem:'METERS',authoringUpAxis:'Z',runtimeUpAxis:'Y',pose:'A_POSE',poseVerified:true,
 measuredLeftUpperArmAngleDeg:40,measuredRightUpperArmAngleDeg:40,centeredWorldOrigin:true,measuredBodyCenterX:0,groundContactY:0,measuredGroundContactMeters:0,groundContactVerified:true,bodyHeightMeters:1.68,skeletonTarget:AVATAR_CANONICAL_SKELETON,stableVertexOrder:true,deformationTopologyReady:true,
 skinningVerified:true,measuredUnweightedBodyVertices:0,measuredMaxBodyBoneInfluences:4,measuredMaxBodyWeightSumError:0.001,uvVerified:true,measuredBodyUvLayers:1,measuredBodyUvOutOfBoundsLoops:0,pbrMaterialsVerified:true,measuredMaterialSlots:3,measuredMaxMaterialsPerObject:1,
 texturesVerified:true,bodyBaseColorTextureVerified:true,bodyNormalTextureVerified:true,bodyOrmTextureVerified:true,textureColorSpacesVerified:true,measuredTextureCount:3,measuredMaxTextureDimension:2048,measuredTotalTexturePixels:12582912,
 dnaMorphsVerified:true,dnaMorphNames:[...HERO_DNA_MORPH_NAMES],measuredDnaMorphCount:HERO_DNA_MORPH_NAMES.length,measuredMaxDnaVertexDeltaMeters:0.12,
 expressionsVerified:true,expressionMorphNames:[...HERO_EXPRESSION_MORPH_NAMES],measuredExpressionMorphCount:HERO_EXPRESSION_MORPH_NAMES.length,measuredMaxExpressionVertexDeltaMeters:0.04,
 objects:[{role:'BODY',vertices:30000,triangles:45000,manifold:true,unappliedTransforms:false,fusedClothingOrAccessories:false},{role:'EYE_L',vertices:800,triangles:1400,manifold:true,unappliedTransforms:false,fusedClothingOrAccessories:false},{role:'EYE_R',vertices:800,triangles:1400,manifold:true,unappliedTransforms:false,fusedClothingOrAccessories:false}],
});

describe('Hero v10 facial-expression production gate',()=>{
 it('accepts canonical measured v10 evidence',()=>expect(validateHeroBlockoutReport(valid())).toBeDefined());
 it('still reuses all v9 geometry/PBR/DNA validation',()=>{const x=valid();x.bodyOrmTextureVerified=false as true;expect(()=>validateHeroBlockoutReport(x)).toThrow(/PBR texture evidence/);});
 it('rejects forged expression verification',()=>{const x=valid();x.expressionsVerified=false as true;expect(()=>validateHeroBlockoutReport(x)).toThrow(/expression evidence/);});
 it('rejects reordered expression morphs',()=>{const x=valid();x.expressionMorphNames=[...HERO_EXPRESSION_MORPH_NAMES].reverse();expect(()=>validateHeroBlockoutReport(x)).toThrow(/non-canonical/);});
 it('rejects client-invented expression morphs',()=>{const x=valid();x.expressionMorphNames[0]='expr_unlock_premium';expect(()=>validateHeroBlockoutReport(x)).toThrow(/non-canonical/);});
 it('rejects a falsified expression count',()=>{const x=valid();x.measuredExpressionMorphCount=999;expect(()=>validateHeroBlockoutReport(x)).toThrow(/non-canonical/);});
 it('rejects malformed expression count from JSON',()=>{const x=valid();(x as any).measuredExpressionMorphCount='10';expect(()=>validateHeroBlockoutReport(x)).toThrow(/non-canonical/);});
 it('rejects empty expression deformation',()=>{const x=valid();x.measuredMaxExpressionVertexDeltaMeters=0;expect(()=>validateHeroBlockoutReport(x)).toThrow(/safe facial budget/);});
 it('rejects expression deformation above 12cm',()=>{const x=valid();x.measuredMaxExpressionVertexDeltaMeters=.120001;expect(()=>validateHeroBlockoutReport(x)).toThrow(/safe facial budget/);});
 it('rejects NaN expression deformation',()=>{const x=valid();x.measuredMaxExpressionVertexDeltaMeters=Number.NaN;expect(()=>validateHeroBlockoutReport(x)).toThrow(/safe facial budget/);});
 it('rejects unknown client fields through the inherited exact-key gate',()=>{const x=valid();(x as any).clientExpressionApproved=true;expect(()=>validateHeroBlockoutReport(x)).toThrow(/unsupported field/);});
});
