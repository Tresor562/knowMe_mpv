import { HERO_BLOCKOUT_ASSET_KEY, HERO_BLOCKOUT_REPORT_VERSION, HeroBlockoutReport, validateHeroBlockoutReport } from './hero-blockout-report.domain';
import { AVATAR_CANONICAL_SKELETON } from './avatar-asset-manifest.domain';

const valid=():HeroBlockoutReport=>({reportVersion:HERO_BLOCKOUT_REPORT_VERSION,assetKey:HERO_BLOCKOUT_ASSET_KEY,unitSystem:'METERS',authoringUpAxis:'Z',runtimeUpAxis:'Y',pose:'A_POSE',poseVerified:true,measuredLeftUpperArmAngleDeg:40,measuredRightUpperArmAngleDeg:40,centeredWorldOrigin:true,measuredBodyCenterX:0,groundContactY:0,measuredGroundContactMeters:0,groundContactVerified:true,bodyHeightMeters:1.68,skeletonTarget:AVATAR_CANONICAL_SKELETON,stableVertexOrder:true,deformationTopologyReady:true,skinningVerified:true,measuredUnweightedBodyVertices:0,measuredMaxBodyBoneInfluences:4,measuredMaxBodyWeightSumError:0.001,uvVerified:true,measuredBodyUvLayers:1,measuredBodyUvOutOfBoundsLoops:0,pbrMaterialsVerified:true,measuredMaterialSlots:4,measuredMaxMaterialsPerObject:1,texturesVerified:true,bodyBaseColorTextureVerified:true,measuredTextureCount:2,measuredMaxTextureDimension:2048,measuredTotalTexturePixels:8388608,objects:[{role:'BODY',vertices:30000,triangles:45000,manifold:true,unappliedTransforms:false,fusedClothingOrAccessories:false},{role:'EYE_L',vertices:800,triangles:1400,manifold:true,unappliedTransforms:false,fusedClothingOrAccessories:false},{role:'EYE_R',vertices:800,triangles:1400,manifold:true,unappliedTransforms:false,fusedClothingOrAccessories:false},{role:'HAIR_PLACEHOLDER',vertices:2500,triangles:4000,manifold:true,unappliedTransforms:false,fusedClothingOrAccessories:false}]});

describe('Hero blockout production gate',()=>{
 it('accepts a measured mobile-ready v7 report',()=>expect(validateHeroBlockoutReport(valid())).toBeDefined());
 it('rejects non-canonical identity',()=>{const x=valid();(x as any).assetKey='forged';expect(()=>validateHeroBlockoutReport(x)).toThrow(/canonical Hero source/);});
 it('rejects non-manifold geometry',()=>{const x=valid();x.objects[0].manifold=false;expect(()=>validateHeroBlockoutReport(x)).toThrow(/non-manifold/);});
 it('rejects fused cosmetics',()=>{const x=valid();x.objects[0].fusedClothingOrAccessories=true;expect(()=>validateHeroBlockoutReport(x)).toThrow(/fused/);});
 it('rejects unlocked vertex order',()=>{const x=valid();x.stableVertexOrder=false as true;expect(()=>validateHeroBlockoutReport(x)).toThrow(/vertex order/);});
 it('rejects invalid measured A-pose',()=>{const x=valid();x.measuredLeftUpperArmAngleDeg=0;expect(()=>validateHeroBlockoutReport(x)).toThrow(/canonical A-pose/);});
 it('rejects excessive skin influences',()=>{const x=valid();x.measuredMaxBodyBoneInfluences=5;expect(()=>validateHeroBlockoutReport(x)).toThrow(/deformation budget/);});
 it('rejects non-normalized skin weights',()=>{const x=valid();x.measuredMaxBodyWeightSumError=.021;expect(()=>validateHeroBlockoutReport(x)).toThrow(/deformation budget/);});
 it('rejects invalid UV evidence',()=>{const x=valid();x.measuredBodyUvLayers=0;expect(()=>validateHeroBlockoutReport(x)).toThrow(/UV evidence/);});
 it('rejects excessive material slots',()=>{const x=valid();x.measuredMaxMaterialsPerObject=3;expect(()=>validateHeroBlockoutReport(x)).toThrow(/material-slot budget/);});
 it('rejects forged texture verification',()=>{const x=valid();x.texturesVerified=false as true;expect(()=>validateHeroBlockoutReport(x)).toThrow(/texture evidence/);});
 it('rejects missing BODY Base Color texture proof',()=>{const x=valid();x.bodyBaseColorTextureVerified=false as true;expect(()=>validateHeroBlockoutReport(x)).toThrow(/texture evidence/);});
 it('rejects zero measured textures',()=>{const x=valid();x.measuredTextureCount=0;expect(()=>validateHeroBlockoutReport(x)).toThrow(/texture evidence/);});
 it('rejects textures above 2K',()=>{const x=valid();x.measuredMaxTextureDimension=4096;expect(()=>validateHeroBlockoutReport(x)).toThrow(/Android texture budget/);});
 it('rejects total texture pixels above four 2K maps',()=>{const x=valid();x.measuredTotalTexturePixels=16777217;expect(()=>validateHeroBlockoutReport(x)).toThrow(/Android texture budget/);});
 it('rejects malformed texture metrics from untrusted JSON',()=>{const x=valid();(x as any).measuredTextureCount='2';expect(()=>validateHeroBlockoutReport(x)).toThrow(/texture evidence/);});
 it('rejects impossible texture pixel totals',()=>{const x=valid();x.measuredTextureCount=2;x.measuredTotalTexturePixels=1;expect(()=>validateHeroBlockoutReport(x)).toThrow(/inconsistent/);});
 it('rejects unknown top-level client fields',()=>{const x=valid();(x as any).clientApproved=true;expect(()=>validateHeroBlockoutReport(x)).toThrow(/unsupported field/);});
 it('rejects duplicate object roles',()=>{const x=valid();x.objects.push({...x.objects[1]});expect(()=>validateHeroBlockoutReport(x)).toThrow(/unique/);});
 it('rejects geometry beyond mobile budget',()=>{const x=valid();x.objects[0].triangles=60001;expect(()=>validateHeroBlockoutReport(x)).toThrow(/budget/);});
});
